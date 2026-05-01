# ═══════════════════════════════════════════════════════════════════════════════
# ANITA PSY — DEPLOY MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════
#
# 

#
# GIT WORKFLOW (отправка кода):
#   make push-staging     develop → staging → push → автодеплой на сервер
#   make push-prod        staging → main    → push → автодеплой на production
#
# СЕРВЕР — STAGING (http://34.140.213.8:8081 / :8082):
#   make staging          задеплоить
#   make staging-stop     остановить
#   make staging-logs     логи в реальном времени
#
# СЕРВЕР — PRODUCTION (https://anita-psy.online / :8443):
#   make prod             задеплоить
#   make prod-stop        остановить
#   make prod-logs        логи в реальном времени
#
# МОНИТОРИНГ:
#   make status           все контейнеры с портами
#   make health           /api/health обоих окружений
# ═══════════════════════════════════════════════════════════════════════════════

.PHONY: push-staging push-prod \
        staging staging-stop staging-logs \
        prod prod-stop prod-logs \
        status health server-prune


# ─── GIT WORKFLOW ─────────────────────────────────────────────────────────────

push-staging:
	@powershell -ExecutionPolicy Bypass -Command "& .\run.ps1 push-staging"

push-prod:
	@powershell -ExecutionPolicy Bypass -Command "& .\run.ps1 push-prod"

# ─── СЕРВЕРНЫЙ STAGING ────────────────────────────────────────────────────────

staging:
	./scripts/deploy-staging-server.sh

staging-stop:
	@echo "🛑 Останавливаем серверный staging..."
	@ssh -o BatchMode=yes wot20@34.140.213.8 "cd /home/aleks90715/anita-psy-staging && sudo docker-compose -f infra/docker-compose.staging-server.yml --env-file .env.staging.server down"
	@echo "✅ Остановлен"

staging-logs:
	ssh -o BatchMode=yes wot20@34.140.213.8 "sudo docker logs anita-backend-staging-srv --tail=100 -f"

# ─── PRODUCTION ───────────────────────────────────────────────────────────────

prod:
	./scripts/deploy.sh

prod-stop:
	@echo "🛑 Останавливаем production..."
	@ssh -o BatchMode=yes wot20@34.140.213.8 "cd '/home/aleks90715/Anita Production 2.1' && docker-compose -f docker-compose.yml down"
	@echo "✅ Остановлен"

prod-logs:
	ssh -o BatchMode=yes wot20@34.140.213.8 "docker logs anita-backend --tail=100 -f"

# ─── МОНИТОРИНГ ───────────────────────────────────────────────────────────────

status:
	@echo ""
	@echo "═══════════════════════════════════════════════════"
	@echo "  ЗАПУЩЕННЫЕ КОНТЕЙНЕРЫ"
	@echo "═══════════════════════════════════════════════════"
	@ssh -o BatchMode=yes wot20@34.140.213.8 'sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"' 2>/dev/null || echo "Сервер недоступен"
	@echo ""

health:
	@echo ""
	@echo "═══════════════════════════════════════════════════"
	@echo "  HEALTH CHECK"
	@echo "═══════════════════════════════════════════════════"
	@echo -n "  Staging    https://staging.anita-psy.online/api/health → "
	@curl -s -o /dev/null -w "%{http_code}\n" https://staging.anita-psy.online/api/health 2>/dev/null || echo "недоступен"
	@echo -n "  Production https://anita-psy.online/api/health → "
	@curl -s -o /dev/null -w "%{http_code}\n" https://anita-psy.online/api/health 2>/dev/null || echo "недоступен"
	@echo ""

server-prune:
	@echo "🧹 Очистка сервера (docker system prune)..."
	@ssh -o BatchMode=yes wot20@34.140.213.8 "sudo docker system prune -af"
	@echo "✅ Сервер очищен"
