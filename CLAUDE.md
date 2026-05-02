# CLAUDE.md — Системный промт проекта Anita-Psy-2.0

> Этот файл читается автоматически при каждой сессии Claude Code.
> Все правила обязательны. Нарушения блокируют коммит.

---

## Проект

**Anita** — AI-психолог на базе xAI Grok. Vanilla JS фронтенд, Express бэкенд, PostgreSQL, Docker.

```
Стек: Node.js 20 · Express · PostgreSQL 15 · pgcrypto · node-pg-migrate · Jest · Supertest
LLM:  xAI Grok (GROK_API_KEY в .env)
Окружения: develop → staging → main (prod)
CI: GitHub Actions → автодеплой на сервер при push в staging/main
```

---

## ⛔ ПРАВИЛО №1 — ПЕРЕД ЛЮБЫМ ИЗМЕНЕНИЕМ

Перед тем как вносить любые правки, Claude Code обязан:

1. Прочитать этот файл полностью
2. Запустить быструю проверку затронутых файлов:
   ```bash
   cd backend && npm run lint:quick 2>/dev/null || node --check <изменённый файл>
   ```
3. После правок — запустить полный тест-сьют:
   ```bash
   cd backend && npm test
   ```
4. Убедиться что все тесты зелёные. Если нет — исправить до коммита.

**Коммит с красными тестами запрещён.**

---

## ⛔ ПРАВИЛО №2 — КРИТИЧЕСКИЕ ПУТИ

Это 5 сценариев которые должны работать ВСЕГДА. Если правка ломает хотя бы один — откатить.

### Путь 1: Авторизация и имя
```
Юзер переходит по инвайту → регистрируется → входит по логину/паролю
→ POST /api/auth/login возвращает { token, username }
→ GET /api/auth/me возвращает { username }
→ Имя отображается на welcome-экране БЕЗ необходимости начинать разговор
```

### Путь 2: Отправка сообщения
```
Юзер пишет сообщение → Enter или кнопка отправки срабатывают
→ POST /api/chat/stream отдаёт SSE-поток
→ Anita отвечает токенами в реальном времени
→ POST /api/conversations/:id/messages сохраняет оба сообщения в БД
→ В консоли браузера нет ошибок
```

### Путь 3: Персонализация (contextManager)
```
buildContextWindow вызывается с реальным userId
→ db.query НЕ падает с ReferenceError
→ Профиль пользователя включён в системный промт к Grok
→ Anita знает имя и историю юзера
```

### Путь 4: Завершение сеанса
```
Юзер нажимает "Завершить сеанс"
→ POST /api/conversations/:id/end возвращает инсайты
→ Модал инсайтов открывается (класс 'show', не 'visible')
→ Юзер сохраняет → инсайты записываются в profile.insights_history
→ Кнопка "Пропустить" закрывает модал
```

### Путь 5: Онбординг нового пользователя
```
Новый юзер (is_onboarded: false) входит
→ GET /api/conversations/memory возвращает { is_onboarded: false }
→ Онбординг-модал показывается автоматически
→ После 4 сообщений is_onboarded становится true
→ Онбординг больше не показывается
```

---

## ⚠️ ИЗВЕСТНЫЕ ХРУПКИЕ МЕСТА

Эти места ломались раньше. При изменении — проверять особенно тщательно.

### 1. DOM инициализация (frontend/app.js)
```js
// ✅ ПРАВИЛЬНО — this.dom ТОЛЬКО в init(), не в constructor():
async init() {
  this.dom = { sendBtn: this.$('#send-btn'), ... }; // ← здесь
  this.bindEvents();
}

// ❌ НЕПРАВИЛЬНО — в constructor():
constructor() {
  this.dom = { ... }; // ← ломает все обработчики событий
}
```

### 2. CSS классы модалов (frontend/app.js + index.css)
```js
// ✅ Везде только 'show':
modal.classList.add('show');
modal.classList.remove('show');

// ❌ Никогда 'visible' для модалов:
modal.classList.add('visible'); // ← CSS не реагирует
```

### 3. db импорт в сервисах (backend/services/)
```js
// ✅ Каждый сервис использующий db ОБЯЗАН иметь:
const db = require('../db');

// ❌ contextManager.js ломался без этого импорта:
// db.query(...) → ReferenceError: db is not defined
```

### 4. Шифрование сообщений (backend/utils/encryption.js)
```
Требует: pgcrypto extension в PostgreSQL
Требует: DB_ENCRYPTION_KEY в .env (минимум 32 символа)
Проверка: SELECT pgp_sym_encrypt('test', 'key') — должна работать без ошибок
```

### 5. profile колонка (backend/services/memoryService.js)
```
Требует: миграция 1714051200004_add_user_profile.js применена
getProfile() падает с 500 если колонка отсутствует
Проверка: SELECT profile FROM user_memory LIMIT 0
```

### 6. Sentry инициализация (backend/app.js)
```js
// ✅ app создаётся ДО Sentry.init:
const app = express();
if (process.env.SENTRY_DSN) Sentry.init({ integrations: [... app ...] });

// ❌ app не существует в момент Sentry.init → интеграция не работает
```

---

## 🧪 ТЕСТЫ — СТРУКТУРА И КОМАНДЫ

```
backend/
├── __tests__/
│   ├── auth.test.js           ← unit: авторизация
│   ├── privacy.test.js        ← unit: GDPR удаление
│   └── integration/
│       ├── auth-flow.test.js  ← критический путь 1
│       ├── chat-flow.test.js  ← критический путь 2 + 3
│       ├── session-end.test.js ← критический путь 4
│       ├── onboarding.test.js ← критический путь 5
│       └── health.test.js     ← deep health check
```

```bash
# Все тесты:
cd backend && npm test

# Только integration:
cd backend && npm run test:integration

# Только unit:
cd backend && npm run test:unit

# Health check (можно запускать на живом сервере):
cd backend && npm run test:health -- --env HEALTH_URL=http://34.140.213.8:8081
```

---

## 🏗 АРХИТЕКТУРНЫЕ ПРАВИЛА

### API маршруты
```
/api/auth/*          → backend/routes/auth.js
/api/chat/*          → backend/routes/chat.js (SSE стриминг)
/api/conversations/* → backend/routes/conversations.js
/api/sessions/*      → backend/routes/userSessions.js
/api/admin/*         → backend/routes/admin*.js (только role='admin')
```

### Шаблон транзакции в БД (при операциях с несколькими таблицами)
```js
const client = await db.pool.connect();
try {
  await client.query('BEGIN');
  // ... операции ...
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Ответы API — обязательные поля
```js
// Успех:
res.json({ success: true, ...data });

// Ошибка:
res.status(4xx/5xx).json({ error: 'Человекочитаемое сообщение' });

// НЕ возвращать stack trace в ответах
```

### SSE стриминг
```
Nginx ОБЯЗАН иметь для /api/ маршрутов:
  proxy_buffering off;
  proxy_cache off;
  X-Accel-Buffering: no
```

---

## 🚀 ДЕПЛОЙ

```
develop  → push → CI тесты (npm test)
staging  → push → CI тесты → build Docker → deploy server → migrate
main     → push → build Docker → deploy prod → migrate → Telegram уведомление
```

**Никогда не пушить напрямую в main.** Только через PR из staging.

---

## 📋 ЧЕКЛИСТ ДО КОММИТА

Claude Code обязан проверить каждый пункт перед `git commit`:

- [ ] `cd backend && npm test` — все тесты зелёные
- [ ] `this.dom` в `app.js` находится в `init()`, не в `constructor()`
- [ ] Все `classList` операции с модалами используют `'show'`, не `'visible'`
- [ ] Каждый файл в `backend/services/` использующий `db` — имеет `require('../db')`
- [ ] `GET /api/conversations/memory` возвращает `is_onboarded` в ответе
- [ ] `GET /api/auth/me` существует и возвращает `{ username }`
- [ ] `POST /api/auth/login` возвращает `{ token, username }`
- [ ] pgcrypto extension активна: `SELECT pgp_sym_encrypt('test','key')` без ошибок
- [ ] Миграция `1714051200004_add_user_profile` применена (`profile` колонка существует)
- [ ] Sentry инициализируется ПОСЛЕ `const app = express()`

---

## 🆘 ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

```bash
# Посмотреть логи staging:
make staging-logs

# Откатить на предыдущий коммит:
git revert HEAD && git push origin staging

# Проверить здоровье сервера:
make health

# Проверить миграции:
docker exec anita-backend-staging-srv npm run migrate:status
```
