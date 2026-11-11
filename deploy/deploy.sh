#!/bin/bash
# Deploy do Circle of Life em produção (https://circleoflife.labzz.studio), rodado pelo Jenkins da
# Labzz (https://ci.labzz.studio) a cada push na master. Cada etapa do Jenkinsfile chama uma fase:
#
#   deploy/deploy.sh build     → monta as 2 imagens (site e API, ARM), tag = 7 primeiros caracteres do commit
#   deploy/deploy.sh push      → envia ao ECR (tags imutáveis; pula a imagem que já existe)
#   deploy/deploy.sh release   → nova versão no ECS sem tirar o app do ar (a nova sobe antes de a
#                                antiga sair); se a nova falhar, volta a anterior e o build fica vermelho
#   deploy/deploy.sh verify    → /api/health pelo endereço público
#
# As migrations do banco rodam sozinhas quando a API nova inicia (apps/api/Dockerfile).
# A infra (ECS, RDS, S3, CloudFront, alarmes) e o porquê de cada escolha: eduzz-aws/infra/circle-of-life.
# Credencial AWS: a role ci-deploy-circle-of-life, assumida na hora — o Jenkins não guarda chave.
set -euo pipefail
set +x   # o Jenkins liga o xtrace: sem isto, a credencial temporária iria para o log

ACCOUNT=899599931505
export AWS_DEFAULT_REGION=us-east-1 AWS_PAGER=""
REGISTRY=$ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
CLUSTER=circle-of-life-prod
SERVICE=circle-of-life-prod
URL=https://circleoflife.labzz.studio
LOGS=/ecs/circle-of-life-prod
TAG=${GIT_COMMIT:?rode pelo Jenkins ou defina GIT_COMMIT}
TAG=${TAG:0:7}
# container da task → repositório no ECR → Dockerfile
APPS=("web circle-of-life-web apps/web/Dockerfile" "api circle-of-life-api apps/api/Dockerfile")

assumir_role() {
  local creds
  creds=$(aws sts assume-role --role-arn "arn:aws:iam::$ACCOUNT:role/ci-deploy-circle-of-life" \
    --role-session-name "jenkins-${BUILD_NUMBER:-manual}-$TAG" \
    --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text)
  read -r AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN <<<"$creds"
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
}

imagem_no_ecr() { aws ecr describe-images --repository-name "$1" --image-ids imageTag="$TAG" >/dev/null 2>&1; }

case "${1:-}" in
  build)
    for a in "${APPS[@]}"; do
      read -r _ repo dockerfile <<<"$a"
      docker build --pull -f "$dockerfile" -t "$REGISTRY/$repo:$TAG" .
    done
    ;;

  push)
    assumir_role
    aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY" 2>/dev/null
    for a in "${APPS[@]}"; do
      read -r _ repo _ <<<"$a"
      if imagem_no_ecr "$repo"; then echo "$repo:$TAG já está no ECR"; else docker push "$REGISTRY/$repo:$TAG"; fi
    done
    docker logout "$REGISTRY" >/dev/null
    ;;

  release)
    assumir_role
    for a in "${APPS[@]}"; do
      read -r _ repo _ <<<"$a"
      imagem_no_ecr "$repo" || { echo "$repo:$TAG não está no ECR"; exit 1; }
    done
    ATUAL=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].taskDefinition' --output text)
    echo "no ar agora: $ATUAL"
    # Parte da última versão ATIVA da família (não da que está no serviço): assim uma configuração
    # nova registrada pela infra (eduzz-aws/infra/circle-of-life) sobe junto com o código.
    FAMILIA=${ATUAL##*/}; FAMILIA=${FAMILIA%:*}
    BASE=$(aws ecs describe-task-definition --task-definition "$FAMILIA" --query taskDefinition.taskDefinitionArn --output text)
    TD_JSON=$(mktemp)
    aws ecs describe-task-definition --task-definition "$BASE" --query '{
        family: taskDefinition.family, taskRoleArn: taskDefinition.taskRoleArn,
        executionRoleArn: taskDefinition.executionRoleArn, networkMode: taskDefinition.networkMode,
        containerDefinitions: taskDefinition.containerDefinitions, cpu: taskDefinition.cpu,
        memory: taskDefinition.memory, runtimePlatform: taskDefinition.runtimePlatform,
        requiresCompatibilities: taskDefinition.requiresCompatibilities}' --output json > "$TD_JSON"
    # Troca só a imagem de cada container (segredos, memória e logs vêm da infra).
    for a in "${APPS[@]}"; do
      read -r container repo _ <<<"$a"
      sed -i -E "s#(\"image\": \"$REGISTRY/$repo):[^\"]*\"#\1:$TAG\"#" "$TD_JSON"
      grep -q "\"image\": \"$REGISTRY/$repo:$TAG\"" "$TD_JSON" || { echo "não achei a imagem de $container na task definition"; exit 1; }
    done
    NOVA=$(aws ecs register-task-definition --cli-input-json "file://$TD_JSON" \
      --query taskDefinition.taskDefinitionArn --output text)
    rm -f "$TD_JSON"
    echo "nova: $NOVA"
    aws ecs update-service --cluster $CLUSTER --service $SERVICE --task-definition "$NOVA" >/dev/null
    # A versão nova sobe ao lado da atual (sem queda). Se UMA task nova falhar, devolvemos a anterior
    # na hora — o circuit breaker do ECS faria o mesmo, mas só depois de várias falhas (15–20 min).
    #
    # "No ar" = a versão nova com todas as tasks rodando, a antiga já fora e o alvo saudável nos dois
    # target groups. Não esperamos o COMPLETED do ECS: ele chega ~2 min depois, com o app já no ar,
    # e esperar não segura a versão antiga (quem a tira é o ECS). Depois de "no ar", observamos mais
    # 30 s; o circuit breaker do ECS continua ativo até o COMPLETED, como segunda rede.
    echo "aguardando a versão nova ficar saudável (a atual segue no ar)…"
    TGS=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].loadBalancers[].targetGroupArn' --output text)
    estado() {  # → "<rollout> <falhas> <rodando> <desejadas> <tasks de outras versões>"
      aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query "services[0].[
        deployments[?taskDefinition=='$NOVA'] | [0].rolloutState, deployments[?taskDefinition=='$NOVA'] | [0].failedTasks,
        deployments[?taskDefinition=='$NOVA'] | [0].runningCount, deployments[?taskDefinition=='$NOVA'] | [0].desiredCount,
        sum(deployments[?taskDefinition!='$NOVA'].runningCount)]" --output text
    }
    alvos_saudaveis() {  # todo alvo de cada target group saudável, e pelo menos um em cada
      local tg st
      for tg in $TGS; do
        st=$(aws elbv2 describe-target-health --target-group-arn "$tg" --query 'TargetHealthDescriptions[].TargetHealth.State' --output text)
        [ -n "$st" ] && [ -z "$(tr '\t' '\n' <<<"$st" | grep -v '^healthy$')" ] || return 1
      done
    }
    ESTADO='' FALHAS=0 NO_AR=''
    for i in $(seq 1 180); do   # até 15 min, de 5 em 5 s
      read -r ESTADO FALHAS RODANDO DESEJADAS OUTRAS < <(estado)
      if [ "$ESTADO" = "FAILED" ] || [ "${FALHAS:-0}" -ge 1 ]; then break; fi
      if [ "$ESTADO" = "COMPLETED" ] || { [ "$RODANDO" = "$DESEJADAS" ] && [ "${OUTRAS%.*}" = 0 ] && alvos_saudaveis; }; then
        NO_AR=$i; break
      fi
      sleep 5
    done
    if [ -n "$NO_AR" ]; then
      echo "no ar em ~$((NO_AR * 5)) s; observando mais 30 s…"
      for i in 1 2 3 4 5 6; do
        sleep 5
        read -r ESTADO FALHAS RODANDO DESEJADAS OUTRAS < <(estado)
        if [ "$ESTADO" = "FAILED" ] || [ "${FALHAS:-0}" -ge 1 ] || [ "$RODANDO" != "$DESEJADAS" ]; then NO_AR=''; break; fi
      done
      [ -n "$NO_AR" ] && { echo "ok: $NOVA no ar"; exit 0; }
    fi
    echo "FALHOU: a versão nova não ficou saudável ($ESTADO, $FALHAS task(s) com falha). Voltando para"
    echo "$ATUAL — o app não saiu do ar. Motivo no log da task: CloudWatch → $LOGS."
    aws ecs update-service --cluster $CLUSTER --service $SERVICE --task-definition "$ATUAL" >/dev/null
    aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE || true
    exit 1
    ;;

  verify)
    for i in $(seq 1 12); do
      if curl -fsS --max-time 10 "$URL/api/health"; then echo; echo "ok: $URL no ar com $TAG"; exit 0; fi
      sleep 5
    done
    echo "FALHOU: $URL/api/health não respondeu"; exit 1
    ;;

  cleanup)
    for a in "${APPS[@]}"; do
      read -r _ repo _ <<<"$a"
      docker image rm "$REGISTRY/$repo:$TAG" >/dev/null 2>&1 || true
    done
    ;;

  *) echo "uso: $0 build|push|release|verify|cleanup"; exit 2 ;;
esac
