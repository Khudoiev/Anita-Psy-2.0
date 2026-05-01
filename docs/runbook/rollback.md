# Руководство по откату (Rollback Runbook)

## Откат Production

Если деплой привел к критической ошибке:
1. Зайди на сервер по SSH: `ssh wot20@34.140.213.8`
2. Перейди в папку: `cd '/home/aleks90715/Anita Production 2.1'`
3. Найди предыдущий стабильный коммит в истории git: `git log --oneline`
4. Откати код к нужному коммиту: `git reset --hard <old_commit_hash>`
5. Пересобери и перезапусти сервисы из этого кода: `docker-compose -f docker-compose.yml up -d --build`
6. Дождись готовности бэкенда: `until wget -qO- http://localhost:4000/api/health &>/dev/null; do sleep 2; done`
7. Вернись к разработчикам и локально исправь проблему. Обязательно откати git историю `main` через `git revert` или патч-фикс.

## Откат БД (Миграции)
Если была применена ошибочная миграция (со 2 фазы), используй:
`npm run migrate:down` внутри контейнера:
`docker exec -it anita-backend npm run migrate:down`
