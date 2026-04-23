#!/bin/bash
# deploy-staging.sh — локальный staging на своей машине
# Использование: ./scripts/deploy-staging.sh
# Запускать из корня проекта

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Деплоим локальный STAGING...${NC}"

# ─── Проверить что .env.staging существует ───────────────────────────────────

if [ ! -f ".env.staging" ]; then
  echo -e "${RED}❌ Файл .env.staging не найден!${NC}"
  echo -e "Создай его: cp .env.staging.example .env.staging — и заполни значения"
  exit 1
fi

# ─── Пересобрать контейнеры ──────────────────────────────────────────────────

echo -e "${YELLOW}🔨 Пересобираем staging контейнеры...${NC}"
docker-compose -f infra/docker-compose.staging.yml --env-file .env.staging down
docker-compose -f infra/docker-compose.staging.yml --env-file .env.staging up -d --build

echo -e "${YELLOW}⏳ Ждём запуска...${NC}"
sleep 8

# ─── Проверка здоровья ───────────────────────────────────────────────────────

echo -e "${YELLOW}🏥 Проверяем здоровье...${NC}"

if docker ps | grep -q "anita-backend-staging"; then
  echo -e "${GREEN}✅ Backend staging запущен${NC}"
else
  echo -e "${RED}❌ Backend staging упал!${NC}"
  docker-compose -f infra/docker-compose.staging.yml logs --tail=50 backend
  exit 1
fi

if docker ps | grep -q "anita-db-staging"; then
  echo -e "${GREEN}✅ Database staging запущена${NC}"
else
  echo -e "${RED}❌ Database staging упала!${NC}"
  exit 1
fi

# ─── Health check API ────────────────────────────────────────────────────────

sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo -e "${GREEN}✅ API отвечает (HTTP 200)${NC}"
else
  echo -e "${YELLOW}⚠️  API вернул $HEALTH — подожди немного и проверь вручную${NC}"
fi

# ─── Итог ────────────────────────────────────────────────────────────────────

COMMIT=$(git rev-parse --short HEAD)
MSG=$(git log -1 --pretty=%B | head -1)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Локальный staging запущен!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "Ветка:    ${BRANCH}"
echo -e "Коммит:   ${COMMIT} — ${MSG}"
echo -e "Сайт:     http://localhost:8080"
echo -e "Admin:    http://localhost:8080/admin"
echo -e "API:      http://localhost:4001/api/health"
echo ""
echo -e "Остановить: docker-compose -f infra/docker-compose.staging.yml down"
echo ""
