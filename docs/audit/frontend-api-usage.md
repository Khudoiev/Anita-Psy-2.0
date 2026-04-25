# Frontend API Usage

## `frontend/auth.html`
* `POST /api/auth/join`
* `POST /api/auth/register`
* `POST /api/auth/login`
* `POST /api/auth/save-consent`
* `POST /api/auth/reset-request`
* `POST /api/auth/reset-password`

## `frontend/app.js`
* `GET /api/chats` (legacy)
* `POST /api/chats` (legacy)
* `GET /api/chats/:id` (legacy)
* `DELETE /api/chats/:id` (legacy)
* `POST /api/chats/:id/messages` (legacy)
* `GET /api/memory`
* `POST /api/memory`
* `POST /api/chat`
* `POST /api/chat/stream`
* `POST /api/chat/extract-memory`
* `POST /api/sessions/start`
* `POST /api/sessions/heartbeat`
* `POST /api/sessions/end`
* `POST /api/conversations/:id/generate-title` (new schema - смешение со старой!)

## `admin/admin.js`
* `POST /api/auth/admin/login`
* Использует `apiFetch` (обёртка) для обращения к множеству endpoints `/api/admin/*`, `/api/sessions/*`, `/api/admin/invites`, `/api/admin/reset-requests`.

## Анализ (Orphans & Broken)
**Broken Calls (Фронт зовет, бэка нет или он не совпадает):**
* Фронт вызывает `/api/conversations/:id/generate-title`, в то время как основная логика чатов построена на `/api/chats` (legacy). Это означает, что фронт частично использует новую архитектуру, а частично старую.

**Orphan Endpoints (Есть в бэке, не вызываются напрямую фронтом в app.js):**
* Большинство роутов `/api/conversations/` (GET `/`, POST `/`, GET `/:id`, POST `/:id/messages`) не используются напрямую в `app.js` (там остались `apiFetch('/chats')`). Это подтверждает, что бэкенд был переписан под `conversations`, но фронт ещё не был полностью переведён.
