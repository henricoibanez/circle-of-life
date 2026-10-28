# Revisão de segurança — Circle of Life

Data: 28/10/2026. Feita por **leitura do código** (não houve ataque ao site publicado,
conforme pedido). Cobre a API (Nest), o site (Next) e as configurações.

> Resumo: o app está **bem protegido** no essencial. Não achei nenhuma falha grave.
> O ponto mais importante é a **falta de limite de tentativas no login**. O resto é
> de risco baixo ou "camada extra de proteção".

## Como ler a gravidade

- **Alta**: corrigir antes de abrir para mais gente.
- **Média**: corrigir em breve.
- **Baixa**: bom corrigir, risco pequeno.
- **Informativo**: já está aceitável; fica registrado.

---

## Vulnerabilidades encontradas

### 1. [Média] Login sem limite de tentativas (força bruta de senha) — ✅ CORRIGIDO (29/10/2026)

> Resolvido: o login agora trava em 10 tentativas por e-mail a cada 10 minutos
> (contagem guardada no banco, na tabela `rate_limits`, para valer também na Vercel).
> Um login certo zera o contador.


A rota de entrar (`/auth/login`) aceita quantas tentativas de senha a pessoa quiser,
sem bloqueio. Como agora dá para entrar com e-mail e senha, alguém poderia tentar
milhares de senhas de uma conta automaticamente. A senha é guardada de um jeito
lento de testar (scrypt), o que atrapalha, mas não impede um ataque automatizado.
Vale também para `/auth/signup` e `/auth/password/forgot`.

**Como resolver:** adicionar um limitador de tentativas (o pacote `@nestjs/throttler`),
por exemplo no máximo 10 tentativas por minuto por IP nas rotas de login/cadastro.

### 2. [Baixa] Pedido de código por e-mail sem teto — ✅ CORRIGIDO (29/10/2026)

> Resolvido: além do intervalo de 1 minuto entre códigos, agora há um teto de
> 10 envios por e-mail por dia.

(registro original abaixo)

"Esqueci minha senha" e o cadastro mandam um código por e-mail. Já existe uma boa
proteção: o código de 6 números expira em 15 minutos, aceita só 5 tentativas erradas
e só dá para pedir outro a cada 1 minuto. Falta um teto geral por IP, para evitar que
alguém fique pedindo códigos para muitos e-mails (enxurrada de e-mails).

**Como resolver:** o mesmo limitador do item 1, aplicado a essas rotas.

### 3. [Baixa] Envio de imagem: a URL temporária não limita o tamanho

Ao enviar uma foto, o app dá uma URL temporária (5 min) para o navegador mandar o
arquivo direto ao storage. O tamanho só é conferido **depois**, na confirmação (e o
arquivo grande demais é apagado). Nesse meio-tempo, uma pessoa logada poderia subir
um arquivo muito grande para a própria pasta e gastar espaço/banda antes da limpeza.

**Como resolver:** definir um limite de tamanho no próprio storage (no Supabase) ou
usar uma URL de envio que já recuse acima de X MB.

### 4. [Baixa] Site sem Content-Security-Policy (CSP)

O site já manda vários cabeçalhos de segurança, mas não tem CSP — uma regra que diz
ao navegador de onde ele pode carregar scripts. É uma camada extra contra ataques de
código injetado (XSS). Hoje o risco é baixo porque o texto do necrológio (o único
lugar que guarda HTML) é limpo no servidor antes de salvar.

**Como resolver:** adicionar um cabeçalho `Content-Security-Policy` no `next.config`.

### 5. [Baixa] É possível descobrir se um e-mail tem conta

Ao entrar, o app responde de forma diferente para "conta que só usa Google" e para
"e-mail/senha errados"; e o cadastro avisa quando "já existe conta com esse e-mail".
Isso deixa alguém descobrir se um e-mail tem conta. O impacto é pequeno porque o app
é só por convite.

**Como resolver (opcional):** mensagens mais genéricas nessas telas.

### 6. [Baixa] Sair não invalida a sessão no servidor

A sessão é um "crachá" assinado (JWT) que vale 30 dias. "Sair" só apaga esse crachá do
navegador; se alguém tivesse copiado o crachá, ele continuaria valendo até expirar.
Ponto bom: uma conta **excluída** (ou rebaixada de admin) perde o acesso na hora,
porque o servidor reconfere a pessoa no banco a cada pedido.

**Como resolver (opcional):** guardar as sessões no banco para poder cancelá-las, ou
reduzir a validade do crachá.

### 7. [Informativo] Sem token anti-CSRF

Não há um token específico contra o ataque em que outro site faz um pedido em seu nome.
Está aceitável porque o cookie de login é `SameSite=lax` (não viaja em pedidos vindos
de outros sites) e a API só aceita corpo em JSON. Fica registrado.

### 8. [Informativo] Conteúdo do usuário vai no pedido à IA

Na análise inteligente, o que você escreveu entra no pedido ao Claude. Alguém poderia
escrever instruções tentando "enganar" a IA, mas o relatório volta só para a própria
pessoa, então não afeta mais ninguém.

---

## O que está bem feito (conferido)

- **Cada um só vê os próprios dados.** Backlog, tarefas, perfil e arquivos são sempre
  filtrados pelo dono; pedir o dado de outra pessoa responde "não encontrado".
- **Ninguém vira admin sozinho.** A tela de perfil só deixa mudar nome, @, bio e foto —
  não o cargo. Convidar/aprovar convites é só para administradores.
- **Login de teste (um clique) só existe no seu computador** — essa rota nem é criada
  em produção.
- **Necrológio é limpo no servidor:** só a formatação do editor passa; scripts, links e
  imagens são removidos (inclusive SVG, que é o truque comum de ataque).
- **Arquivos num storage privado**, acessados por links temporários; o endereço do
  arquivo é escolhido pelo servidor, não pelo usuário.
- **Senha guardada com scrypt** (nunca a senha em si); o código do e-mail também é
  guardado só como resumo.
- **Crachá de login em cookie httpOnly** (o JavaScript da página não lê), e o servidor
  reconfere a pessoa no banco a cada pedido.
- **Configuração conferida ao iniciar:** a API não sobe com segredos faltando e recusa
  o segredo de exemplo em produção.
- **Toda entrada é validada** e campos desconhecidos são rejeitados.
- **Banco pelo Prisma**, sem comandos SQL montados à mão — sem brecha de injeção de SQL.

---

## Sugestão de prioridade

1. ~~Itens 1 e 2: limite de tentativas no login, cadastro e senha.~~ ✅ feito (29/10/2026).
2. Item 4: adicionar a CSP no site.
3. Item 3: limite de tamanho no storage.
4. Itens 5 e 6: quando sobrar tempo.
