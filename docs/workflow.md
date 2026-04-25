# Git Workflow

## 1. Новая фича
1. Отведи ветку от `develop`: `git checkout develop && git checkout -b feature/my-feature`
2. Сделай коммиты. Убедись, что они логически разбиты и работают: `git commit -m "feat: my feature"`
3. Создай Pull Request в `develop`.
4. После код-ревью и зеленых тестов (CI) замержи PR.

## 2. Релиз в Staging (Тестирование)
1. Создай PR из `develop` в `staging`.
2. После мержа GitHub Actions соберет Docker образ `anita-backend:staging-latest` в GHCR.
3. Задеплой на сервер: `make staging`.

## 3. Релиз в Production
1. Убедись, что всё протестировано на `staging`.
2. Создай PR из `staging` в `main`.
3. После мержа GitHub Actions соберет образ `anita-backend:main-latest`.
4. Задеплой на сервер: `make prod`.

## 4. Hotfix (Срочный фикс продакшена)
1. Отведи ветку от `main`: `git checkout main && git checkout -b hotfix/my-fix`
2. Сделай фикс.
3. Создай PR в `main` И создай PR в `develop` (чтобы фикс не потерялся при следующем релизе).
4. Замержи в `main` и задеплой: `make prod`.
