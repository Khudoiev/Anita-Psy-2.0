# Tech Debt

## "Table may not exist yet" (Hacks)
Из-за отсутствия нормальной системы миграций в коде повсеместно используются пустые `try/catch` блоки для подавления ошибок при отсутствии таблиц. Это маскирует реальные проблемы.
* `backend/services/techniqueTracker.js:32` — `return; // tables may not exist yet`
* `backend/routes/chat.js:87` — `} catch (e) { /* table may not exist yet */ }`
* `backend/routes/chat.js:129` — `} catch (e) { /* safety table may not exist yet */ }`
* `backend/routes/chat.js:176` — `} catch (e) { /* tables may not exist yet */ }`
* `backend/prompts/anita.js:160` — `// promptEvolution table may not exist yet`
* `backend/prompts/anita.js:168` — `// user_memory table may not exist yet`

## Дублирование логики
* `/api/chat` (v1) и `/api/chat/v2/stream` (v2) сильно дублируются.
* Существуют две параллельные архитектуры хранения чатов: `user_chats`/`chat_messages` (legacy, в `/api/chats`) и `conversations`/`messages` (new, в `/api/conversations`). Фронтенд сейчас использует гибрид.

## Отсутствующие миграции (Схема в хаосе)
В `backend/db/` есть:
* `schema.sql` (монтируется в докер напрямую)
* `update_schema.sql` (содержит `CREATE TABLE IF NOT EXISTS`)
* `migrations/006_full_architecture.sql` (применяется вручную?)
Непонятно, в каком состоянии БД в каждый момент времени, нет версионирования.
