#!/bin/bash
# deploy-staging-server.sh — локальная сборка и деплой на staging
# Использование: ./scripts/deploy-staging-server.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Начинаем staging деплой...${NC}"

# ─── Проверки перед деплоем ───────────────────────────────────────────────────

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "staging" ]; then
  echo -e "${RED}❌ Деплоить на staging можно только с ветки staging!${NC}"
  echo -e "Сейчас: ${CURRENT_BRANCH}"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}❌ Есть несохранённые изменения! Сделай commit перед деплоем.${NC}"
  git status --short
  exit 1
fi

# ─── Обновить код ─────────────────────────────────────────────────────────────

echo -e "${YELLOW}📥 Отправляем изменения в GitHub...${NC}"
git push origin staging

# ─── Деплой на сервере ────────────────────────────────────────────────────────

echo -e "${YELLOW}📦 Деплоим на сервере (локальная сборка)...${NC}"

# Путь на сервере: /home/aleks90715/anita-psy-staging
ssh -o BatchMode=yes wot20@34.140.213.8 "cd '/home/aleks90715/anita-psy-staging' && \
  sudo git fetch origin staging && \
  sudo git reset --hard origin/staging && \
  sudo git clean -fd && \
  sudo docker-compose -f infra/docker-compose.staging-server.yml --env-file .env.staging.server up -d --build && \
  echo 'Ждём готовности бэкенда...' && \
  timeout 60 bash -c 'until sudo docker exec anita-backend-staging-srv wget -qO- http://localhost:4001/api/health &>/dev/null; do sleep 2; done' && \
  sudo docker exec anita-backend-staging-srv npm run migrate:up && \
  sudo docker system prune -f"

echo -e "${GREEN}✅ Staging деплой успешно завершен!${NC}"
