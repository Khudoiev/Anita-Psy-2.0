#!/bin/bash
# deploy.sh — безопасный деплой на production
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

echo -e "${YELLOW}📥 Загружаем изменения с git...${NC}"
git pull origin main

# ─── Создать external volume если не существует ───────────────────────────────

if ! docker volume inspect anitapsy_postgres_data >/dev/null 2>&1; then
  echo -e "${YELLOW}📦 Создаём postgres volume...${NC}"
  docker volume create anitapsy_postgres_data
  echo -e "${GREEN}✅ Volume создан${NC}"
fi

# ─── Пересобрать контейнеры ───────────────────────────────────────────────────

echo -e "${YELLOW}🔨 Пересобираем контейнеры...${NC}"
docker-compose -f docker-compose.yml up -d --build

echo -e "${YELLOW}⏳ Ждём запуска сервисов...${NC}"
sleep 8

# ─── Проверка здоровья ────────────────────────────────────────────────────────

check_service() {
  local name=$1
  local container=$2
  if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
    echo -e "${GREEN}✅ $name запущен${NC}"
  else
    echo -e "${RED}❌ $name НЕ запустился! Логи:${NC}"
    docker-compose -f docker-compose.yml logs --tail=30 "$name"
    exit 1
  fi
}

check_service "Database"  "anita-db"
check_service "Backend"   "anita-backend"
check_service "Frontend"  "anita-frontend"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ API отвечает (HTTP 200)${NC}"
else
  echo -e "${YELLOW}⚠️  API вернул ${HTTP_STATUS}${NC}"
fi

# ─── Итог ─────────────────────────────────────────────────────────────────────

COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B | head -1)

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Production деплой завершён!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "Коммит:  ${COMMIT_HASH} — ${COMMIT_MSG}"
echo -e "Фронт:   https://anita-psy.online"
echo -e "Админка: https://anita-psy.online:8443"
echo ""
