// Deploy automático do Circle of Life: push na master → https://ci.labzz.studio → https://circleoflife.labzz.studio
// O que cada etapa faz está em deploy/deploy.sh.
pipeline {
  agent any
  options {
    timeout(time: 40, unit: 'MINUTES')
    disableConcurrentBuilds()
  }
  stages {
    stage('Build')   { steps { sh 'deploy/deploy.sh build' } }
    stage('Push')    { steps { sh 'deploy/deploy.sh push' } }
    stage('Deploy')  { steps { sh 'deploy/deploy.sh release' } }
    stage('Verify')  { steps { sh 'deploy/deploy.sh verify' } }
  }
  post { always { sh 'deploy/deploy.sh cleanup' } }
}
