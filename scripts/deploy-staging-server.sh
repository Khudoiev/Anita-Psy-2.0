#!/bin/bash
# deploy-staging-server.sh — деплой на серверный staging
# Запускается на staging сервере (вручную или через GitHub Actions)
# Использование: ./scripts/deploy-staging-server.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Деплоим на СЕРВЕРНЫЙ STAGING...${NC}"

# ─── Проверить что .env.staging.server существует ────────────────────────────

if [ ! -f ".env.staging.server" ]; then
  echo -e "${RED}❌ Файл .env.staging.server не найден!${NC}"
  echo -e "Создай его на сервере и заполни значения (см. документацию)"
  exit 1
fi

# ─── Обновить код из staging ветки ───────────────────────────────────────────

echo -e "${YELLOW}📥 Загружаем staging ветку...${NC}"
git fetch origin
git checkout staging
git pull origin staging

# ─── Пересобрать контейнеры ──────────────────────────────────────────────────

echo -e "${YELLOW}🔨 Пересобираем контейнеры...${NC}"
docker-compose -f infra/docker-compose.staging-server.yml --env-file .env.staging.server down
docker-compose -f infra/docker-compose.staging-server.yml --env-file .env.staging.server up -d --build

echo -e "${YELLOW}⏳ Ждём запуска...${NC}"
sleep 10

# ─── Проверка здоровья ───────────────────────────────────────────────────────

echo -e "${YELLOW}🏥 Проверяем здоровье...${NC}"

if docker ps | grep -q "anita-backend-staging-srv"; then
  echo -e "${GREEN}✅ Backend staging запущен${NC}"
else
  echo -e "${RED}❌ Backend staging упал!${NC}"
  docker-compose -f infra/docker-compose.staging-server.yml logs --tail=50 backend
  exit 1
fi

if docker ps | grep -q "anita-db-staging-srv"; then
  echo -e "${GREEN}✅ Database staging запущена${NC}"
else
  echo -e "${RED}❌ Database staging упала!${NC}"
  exit 1
fi

# ─── Health check API ────────────────────────────────────────────────────────

sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://staging.anita-psy.online/api/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo -e "${GREEN}✅ API отвечает (HTTP 200)${NC}"
else
  echo -e "${YELLOW}⚠️  API вернул $HEALTH${NC}"
fi

# ─── Итог ────────────────────────────────────────────────────────────────────

COMMIT=$(git rev-parse --short HEAD)
MSG=$(git log -1 --pretty=%B | head -1)

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Серверный staging обновлён!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "Коммит: ${COMMIT} — ${MSG}"
echo -e "Сайт:   https://staging.anita-psy.online"
echo -e "Admin:  https://staging.anita-psy.online/admin"
echo ""
