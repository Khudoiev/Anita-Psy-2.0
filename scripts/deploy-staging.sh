#!/bin/bash
# deploy-staging.sh — для staging branch
# Использование: ./deploy-staging.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Деплоим на STAGING...${NC}"

# ─── Проверка что мы на staging ветке ───────────────────────────────────────

CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" != "staging" ]; then
  echo -e "${RED}❌ Нужна ветка staging! Сейчас: $CURRENT${NC}"
  exit 1
fi

# ─── Обновить код ───────────────────────────────────────────────────────────

echo -e "${YELLOW}📥 Загружаем изменения...${NC}"
git pull origin staging

# ─── Пересобрать контейнеры ──────────────────────────────────────────────────

echo -e "${YELLOW}🔨 Пересобираем staging...${NC}"
# Используем отдельный compose файл для staging
docker-compose -f infra/docker-compose.staging.yml down
docker-compose -f infra/docker-compose.staging.yml up -d --build

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

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo -e "${GREEN}✅ API отвечает${NC}"
else
  echo -e "${YELLOW}⚠️  API вернул $HEALTH${NC}"
fi

# ─── Итог ────────────────────────────────────────────────────────────────────

COMMIT=$(git rev-parse --short HEAD)
MSG=$(git log -1 --pretty=%B | head -1)

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Staging деплой завершён!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "Коммит: ${COMMIT} — ${MSG}"
echo -e "Тестируй: https://staging.anita-psy.com"
echo -e "Admin:    https://staging.anita-psy.com/admin"
echo ""
