#!/bin/bash
PROJECT_DIR=$(sudo ls -d /home/aleks90715/my-agent/ANITA-PSY-main/project/Anita* | head -n 1)
cd "$PROJECT_DIR" || exit 1

echo "Moving new .env to project root..."
sudo mv /home/wot20/.env ./.env

echo "Updating Database password (SAFE HEX)..."
# Смена пароля на версию без спецсимволов
sudo docker exec -i anita-db psql -U anita -d anita -c "ALTER USER anita WITH PASSWORD 'eae668066f1e4172f52d5df7b6edacee51d2edaa60763005';"

echo "Restarting containers with new secrets..."
sudo docker-compose up -d

echo "Security update complete & fixed!"
