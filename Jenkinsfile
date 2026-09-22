pipeline {
    agent any

    environment {
        // === CONFIGURATION ===
        
        // 1. Registry Settings
        REGISTRY_IP   = "192.168.0.222" 
        REGISTRY_PORT = "5050"
        
        // 2. Deployment Server Settings
        DEPLOY_SERVER_IP = "192.168.0.223"
        
        // 3. Git Repository Settings
        GIT_REPO_URL  = "git@github.com:sergesvalov/finances.git"
        
        // 4. Docker Image Naming
        DOCKER_IMAGE_BACKEND  = "${REGISTRY_IP}:${REGISTRY_PORT}/finances-backend"
        DOCKER_IMAGE_FRONTEND = "${REGISTRY_IP}:${REGISTRY_PORT}/finances-frontend"
        
        // 5. Credentials
        SSH_CREDS_ID  = "serge"
        SERVER_USER   = "serge"
        
        // 6. Application Parameters
        PROJECT_DIR    = "/opt/finances"
        HOST_PORT      = "7050"            // Порт для внешнего доступа к фронтенду
    }

    stages {
        stage('Source Checkout') {
            steps {
                script {
                    echo "Checking out finances source code from branch ${env.BRANCH_NAME}..."
                    checkout scm
                }
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    echo "Building Backend & Frontend Docker images (Branch: ${env.BRANCH_NAME})..."
                    
                    // Билд бэкенда
                    dir('backend') {
                        sh "docker build -t ${DOCKER_IMAGE_BACKEND}:${env.BRANCH_NAME}-${BUILD_NUMBER} -t ${DOCKER_IMAGE_BACKEND}:latest ."
                    }
                    
                    // Билд фронтенда
                    dir('frontend') {
                        sh "docker build -t ${DOCKER_IMAGE_FRONTEND}:${env.BRANCH_NAME}-${BUILD_NUMBER} -t ${DOCKER_IMAGE_FRONTEND}:latest ."
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                script {
                    echo "Pushing images to registry..."
                    sh "docker push ${DOCKER_IMAGE_BACKEND}:${env.BRANCH_NAME}-${BUILD_NUMBER}"
                    sh "docker push ${DOCKER_IMAGE_BACKEND}:latest"
                    
                    sh "docker push ${DOCKER_IMAGE_FRONTEND}:${env.BRANCH_NAME}-${BUILD_NUMBER}"
                    sh "docker push ${DOCKER_IMAGE_FRONTEND}:latest"
                }
            }
        }

        stage('Remote SSH Deploy') {
            steps {
                script {
                    echo "Deploying to ${DEPLOY_SERVER_IP}..."
                    
                    // Создаем docker-compose файл без локальной БД, 
                    // ссылаясь на PostgreSQL хоста (host.docker.internal)
                    def composeContent = """
version: "3.8"

services:
  backend:
    image: ${DOCKER_IMAGE_BACKEND}:latest
    restart: always
    network_mode: "host"
    environment:
      - DATABASE_URL=postgresql://postgres@127.0.0.1:5432/finances_db

  frontend:
    image: ${DOCKER_IMAGE_FRONTEND}:latest
    restart: always
    ports:
      - "${HOST_PORT}:80"
    extra_hosts:
      - "host.docker.internal:host-gateway"
"""

                    sshagent(credentials: [SSH_CREDS_ID]) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${DEPLOY_SERVER_IP} '
                                echo ">>> Setting up target directory..."
                                sudo mkdir -p ${PROJECT_DIR}
                                sudo chown -R ${SERVER_USER}:${SERVER_USER} ${PROJECT_DIR}
                                cd ${PROJECT_DIR}
                                
                                echo ">>> Creating finances database if it does not exist..."
                                sudo -u postgres psql -c "CREATE DATABASE finances_db;" || true
                                
                                echo ">>> Creating docker-compose.yml..."
                                cat <<EOF > docker-compose.yml
${composeContent}
EOF

                                echo ">>> Pulling latest images..."
                                sudo docker compose pull

                                echo ">>> Restarting services..."
                                sudo docker compose up -d
                                    
                                echo ">>> Deployment finished."
                            '
                        """
                    }
                }
            }
        }

        stage('Health Check & Logs') {
            steps {
                script {
                    echo "Verifying application availability and fetching logs..."
                    sleep 10
                    
                    sshagent(credentials: [SSH_CREDS_ID]) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${DEPLOY_SERVER_IP} '
                                cd ${PROJECT_DIR}
                                echo ">>> Container Status:"
                                sudo docker compose ps
                                
                                echo ">>> Container Logs (last 100 lines):"
                                sudo docker compose logs --tail=100
                            '
                        """
                    }
                    
                    // Проверяем health эндпоинт фронта и бэкенда (через Nginx)
                    sh "curl -f -s http://${DEPLOY_SERVER_IP}:${HOST_PORT}/api/health || echo 'Warning: Backend API might not be ready'"
                }
            }
        }
    }

    post {
        always {
            echo "Cleaning up local build environment..."
            sh "docker rmi ${DOCKER_IMAGE_BACKEND}:${env.BRANCH_NAME}-${BUILD_NUMBER} || true"
            sh "docker rmi ${DOCKER_IMAGE_BACKEND}:latest || true"
            sh "docker rmi ${DOCKER_IMAGE_FRONTEND}:${env.BRANCH_NAME}-${BUILD_NUMBER} || true"
            sh "docker rmi ${DOCKER_IMAGE_FRONTEND}:latest || true"
        }
        success {
            echo "Finance Tracker successfully deployed! Build: ${env.BRANCH_NAME}-${BUILD_NUMBER}"
        }
        failure {
            echo "Finance Tracker deployment failed."
        }
    }
}
