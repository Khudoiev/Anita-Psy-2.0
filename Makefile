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
	docker-compose -f infra/docker-compose.staging-server.yml --env-file .env.staging.server down
	@echo "✅ Остановлен"

staging-logs:
	docker-compose -f infra/docker-compose.staging-server.yml logs -f --tail=100

# ─── PRODUCTION ───────────────────────────────────────────────────────────────

prod:
	./scripts/deploy.sh

prod-stop:
	@echo "🛑 Останавливаем production..."
	docker-compose -f docker-compose.yml down
	@echo "✅ Остановлен"

prod-logs:
	docker-compose -f docker-compose.yml logs -f --tail=100

# ─── МОНИТОРИНГ ───────────────────────────────────────────────────────────────

status:
	@echo ""
	@echo "═══════════════════════════════════════════════════"
	@echo "  ЗАПУЩЕННЫЕ КОНТЕЙНЕРЫ"
	@echo "═══════════════════════════════════════════════════"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker не запущен"
	@echo ""

health:
	@echo ""
	@echo "═══════════════════════════════════════════════════"
	@echo "  HEALTH CHECK"
	@echo "═══════════════════════════════════════════════════"
	@echo -n "  Staging  http://localhost:8081/api/health → "
	@curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/api/health 2>/dev/null || echo "недоступен"
	@curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/health  → "
	@curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/health 2>/dev/null || echo "недоступен"
	@echo ""

server-prune:
	@echo "🧹 Очистка сервера (docker system prune)..."
	@ssh -o BatchMode=yes wot20@34.140.213.8 "sudo docker system prune -af"
	@echo "✅ Сервер очищен"
