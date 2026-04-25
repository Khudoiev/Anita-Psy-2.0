# Руководство по откату (Rollback Runbook)

## Откат Production

Если деплой привел к критической ошибке:
1. Зайди на сервер по SSH: `ssh wot20@34.140.213.8`
2. Перейди в папку: `cd '/home/aleks90715/Anita Production 2.1'`
3. Найди предыдущий стабильный коммит в истории git: `git log --oneline`
4. Откати ветку `main` к предыдущему состоянию: `git reset --hard <old_commit_hash>`
5. Скачай образ, соответствующий этому коммиту: `docker pull ghcr.io/khudoiev/anita-psy-2.0-backend:main-<old_commit_hash>`
6. Отредактируй `docker-compose.yml`, чтобы он указывал на скачанный образ:
   ```yaml
   backend:
     image: ghcr.io/khudoiev/anita-psy-2.0-backend:main-<old_commit_hash>
   ```
7. Перезапусти сервисы: `docker-compose up -d`
8. Вернись к разработчикам и локально исправь проблему. Обязательно откати git историю `main` обратно через `git revert` или исправление фикса.

## Откат БД (Миграции)
Если была применена ошибочная миграция (со 2 фазы), используй:
`npm run migrate:down` внутри контейнера:
`docker exec -it anita-backend npm run migrate:down`
