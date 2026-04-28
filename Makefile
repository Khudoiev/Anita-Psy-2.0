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
        status health


# ─── GIT WORKFLOW ─────────────────────────────────────────────────────────────

push-staging:
	@echo "📦 Отправляем develop → staging → GitHub..."
	@CURRENT=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT" != "develop" ]; then \
	  echo "❌ Сейчас на ветке '$$CURRENT'. Переключись на develop: git checkout develop"; \
	  exit 1; \
	fi
	@if [ -n "$$(git status --porcelain)" ]; then \
	  echo "❌ Есть несохранённые изменения! Сделай commit."; \
	  git status --short; \
	  exit 1; \
	fi
	git checkout staging
	git merge develop
	git push origin staging
	git checkout develop
	@echo "✅ Запушено в staging. GitHub Actions деплоит на сервер."

push-prod:
	@echo "🚀 Отправляем staging → main → GitHub..."
	@CURRENT=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT" != "staging" ] && [ "$$CURRENT" != "develop" ]; then \
	  echo "❌ Переключись на staging или develop перед push-prod"; \
	  exit 1; \
	fi
	git checkout main
	git merge staging
	git push origin main
	git checkout develop
	@echo "✅ Запушено в main. GitHub Actions деплоит на production."

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
	@echo -n "  Prod     http://localhost:4000/api/health  → "
	@curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/health 2>/dev/null || echo "недоступен"
	@echo ""
