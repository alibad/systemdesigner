pipeline {
  agent none

  options {
    buildDiscarder(logRotator(numToKeepStr: '30'))
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
  }

  stages {
    stage('Verify') {
      agent { label 'linux && isolated' }
      steps {
        checkout scm
        sh './ci/verify.sh'
        stash name: 'release-bundle', includes: 'dist/app.tar.gz'
      }
      post {
        always {
          junit testResults: 'reports/**/*.xml', allowEmptyResults: false
        }
        cleanup {
          deleteDir()
        }
      }
    }

    stage('Promote') {
      when {
        beforeInput true
        branch 'main'
      }
      input {
        message 'Promote the verified bundle to production?'
        ok 'Promote'
        submitter 'release-engineers'
      }
      agent { label 'linux && production-deploy' }
      options {
        timeout(time: 10, unit: 'MINUTES')
      }
      steps {
        unstash 'release-bundle'
        withCredentials([
          string(
            credentialsId: 'production-deployer-token',
            variable: 'DEPLOY_TOKEN'
          )
        ]) {
          sh '''
            set +x
            ./ci/deploy.sh dist/app.tar.gz
          '''
        }
      }
      post {
        cleanup {
          deleteDir()
        }
      }
    }
  }
}
