#!/bin/bash
# deploy.sh — безопасный деплой на production через GHCR
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

echo -e "${YELLOW}⏳ Ждем сборку образа (рекомендуется проверить Actions в браузере)...${NC}"
sleep 5

# ─── Деплой на сервере ────────────────────────────────────────────────────────

echo -e "${YELLOW}📦 Деплоим на сервере (загружаем образ из GHCR)...${NC}"

# Путь на сервере: /home/aleks90715/Anita Production 2.1
ssh -o BatchMode=yes wot20@34.140.213.8 "cd '/home/aleks90715/Anita Production 2.1' && \
  git pull origin main && \
  docker pull ghcr.io/khudoiev/anita-psy-2.0-backend:main-latest && \
  docker-compose -f docker-compose.yml up -d"

echo -e "${GREEN}✅ Деплой успешно завершен!${NC}"
