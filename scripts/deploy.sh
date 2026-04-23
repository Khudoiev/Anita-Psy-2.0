#!/bin/bash
# deploy.sh — безопасный деплой на продакшн
# Использование: ./deploy.sh
# Или с веткой: ./deploy.sh feature/my-branch (для тестирования)

set -e  # Стоп при любой ошибке

# ─── Цвета для вывода ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Начинаем деплой...${NC}"

# ─── Проверки перед деплоем ───────────────────────────────────────────────────

# Только main ветка идёт на прод (если не передан аргумент)
TARGET_BRANCH=${1:-main}
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$TARGET_BRANCH" = "main" ] && [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}❌ Деплоить на прод можно только с ветки main!${NC}"
  echo -e "Сейчас: ${CURRENT_BRANCH}"
  echo -e "Переключись: git checkout main"
  exit 1
fi

# Проверить что нет несохранённых изменений
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}❌ Есть несохранённые изменения! Сделай commit перед деплоем.${NC}"
  git status --short
  exit 1
fi

# ─── Деплой ───────────────────────────────────────────────────────────────────

echo -e "${YELLOW}📥 Загружаем изменения с git...${NC}"
git pull origin "$TARGET_BRANCH"

echo -e "${YELLOW}🔨 Пересобираем контейнеры...${NC}"
# Используем только docker-compose.yml (без override.yml который только для локала)
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

# Проверка API
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ API отвечает (HTTP 200)${NC}"
else
  echo -e "${YELLOW}⚠️  API вернул ${HTTP_STATUS} — проверь вручную${NC}"
fi

# ─── Итог ─────────────────────────────────────────────────────────────────────

COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B | head -1)

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Деплой завершён успешно!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "Коммит: ${COMMIT_HASH} — ${COMMIT_MSG}"
echo -e "Сайт:   https://anita-psy.online"
echo -e "Admin:  https://anita-psy.online/admin"
echo ""
