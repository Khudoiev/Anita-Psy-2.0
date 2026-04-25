# Текущий статус: План доведения до бета-версии

## 🔍 ФАЗА 1 — АУДИТ
- [x] Аудит схемы БД на всех окружениях
- [x] Карта таблиц
- [x] Карта API endpoints
- [x] Карта фронта
- [x] Воспроизвести и задокументировать баги
- [x] Аудит технического долга
- [x] Аудит безопасности
- [x] Аудит истории git
- [x] Реальное состояние production

## 🔄 ФАЗА 1.5 — СИНХРОНИЗАЦИЯ ВЕТОК + CLEANUP + GHCR
- [x] Бэкап веток (созданы теги backup-*)
- [x] Очистить историю main от дубликатов (rebase)
- [x] Синхронизировать develop с main
- [x] Синхронизировать staging с develop
- [x] Настроить GitHub Container Registry (создан build.yml)
- [x] Переписать deploy-скрипты (deploy.sh, deploy-staging-server.sh)
- [x] Документация workflow (docs/workflow.md, docs/runbook/deploy.md, docs/runbook/rollback.md)
