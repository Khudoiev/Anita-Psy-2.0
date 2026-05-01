#!/bin/bash
# deploy.sh — локальная сборка и деплой на production
# Использование: ./scripts/deploy.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Начинаем production деплой...${NC}"

# ─── Проверки перед деплоем ───────────────────────────────────────────────────

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}❌ Деплоить на прод можно только с ветки main!${NC}"
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
git push origin main

# ─── Деплой на сервере ────────────────────────────────────────────────────────

echo -e "${YELLOW}📦 Деплоим на сервере (локальная сборка)...${NC}"

# Путь на сервере: /home/aleks90715/Anita Production 2.1
ssh -o BatchMode=yes wot20@34.140.213.8 "cd '/home/aleks90715/Anita Production 2.1' && \
  git fetch origin main && \
  git reset --hard origin/main && \
  git clean -fd && \
  docker-compose -f docker-compose.yml up -d --build --remove-orphans && \
  echo 'Ждём готовности бэкенда...' && \
  timeout 60 bash -c 'until wget -qO- http://localhost:4000/api/health &>/dev/null; do sleep 2; done' && \
  docker exec anita-backend npm run migrate:up && \
  docker system prune -f"

echo -e "${GREEN}✅ Production деплой успешно завершен!${NC}"
