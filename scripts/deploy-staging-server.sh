#!/bin/bash
# deploy-staging-server.sh — безопасный деплой на staging через GHCR
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

echo -e "${YELLOW}⏳ Ждем сборку образа (рекомендуется проверить Actions в браузере)...${NC}"
sleep 5

# ─── Деплой на сервере ────────────────────────────────────────────────────────

echo -e "${YELLOW}📦 Деплоим на сервере (загружаем образ из GHCR)...${NC}"

# Путь на сервере: /home/aleks90715/anita-psy-staging
ssh -o BatchMode=yes wot20@34.140.213.8 "cd '/home/aleks90715/anita-psy-staging' && \
  git checkout staging && \
  git pull origin staging && \
  docker pull ghcr.io/khudoiev/anita-psy-2.0-backend:staging-latest && \
  docker-compose -f infra/docker-compose.staging-server.yml --env-file .env.staging.server up -d && \
  docker exec anita-backend-staging-srv npm run migrate:up"

echo -e "${GREEN}✅ Staging деплой успешно завершен!${NC}"
