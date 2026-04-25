# API Map

## Auth Routes (`/api/auth`)
* `POST /api/auth/register` - Регистрация по инвайту. (Таблицы: `users`, `invites`)
* `POST /api/auth/login` - Авторизация юзера. (Таблицы: `users`)
* `GET /api/auth/me` - Текущий пользователь. Auth: req (JWT). (Таблицы: `users`)
* `DELETE /api/auth/delete-me` - Удаление аккаунта (GDPR). Auth: req. (Таблицы: `users` CASCADE)
* `POST /api/auth/admin/login` - Авторизация админа. (Таблицы: `admins`, `admin_logs`)
* `POST /api/auth/reset-request` - Запрос на сброс пароля. (Таблицы: `password_reset_requests`)

## Chat / Streaming (`/api/chat`)
* `POST /api/chat/stream` - Стриминг ответа Grok (Legacy/v1). Auth: req. (Таблицы: `message_quota`)
* `POST /api/chat/v2/stream` - Стриминг ответа Grok (v2). Auth: req/guest. (Таблицы: `message_quota`, `token_usage`, `technique_outcomes`)

## Conversations (New Chat Arch) (`/api/conversations`)
* `GET /` - Список бесед. Auth: req. (Таблицы: `conversations`)
* `POST /` - Новая беседа. Auth: req/guest. (Таблицы: `conversations`)
* `GET /:id` - История. Auth: req/guest. (Таблицы: `conversations`, `messages`)
* `POST /:id/messages` - Добавить сообщение. Auth: req/guest. (Таблицы: `messages`)
* `POST /migrate-guest` - Перенос гостевой беседы юзеру. Auth: req. (Таблицы: `conversations`)
* `DELETE /:id` - Архив беседы. Auth: req. (Таблицы: `conversations`)

## Chats (Legacy) (`/api/chats`)
* `GET /chats` - Список старых чатов. Auth: req. (Таблицы: `user_chats`)
* `GET /chats/:id` - История старого чата. Auth: req. (Таблицы: `chat_messages`)
* `POST /chats/:id/messages` - Сообщение в старый чат. Auth: req. (Таблицы: `chat_messages`)

## User Sessions (`/api/sessions`)
* `POST /start` - Начало сессии. Auth: req. (Таблицы: `sessions`)
* `POST /end` - Конец сессии. Auth: req. (Таблицы: `sessions`)
* `POST /heartbeat` - Поддержание онлайна. Auth: req. (Таблицы: `sessions`)

## Admin Routes (`/api/admin`)
* **Invites (`/api/admin/invites`)**: GET, POST, DELETE. Auth: Admin. (Таблицы: `invites`)
* **Reset Requests (`/api/admin/reset-requests`)**: GET, POST /approve, POST /reject. Auth: Admin. (Таблицы: `password_reset_requests`, `users`)
* **Sessions/Analytics (`/api/admin`)**:
  * `GET /stats`, `/analytics/hourly`, `/analytics/retention`. Auth: Admin. (Таблицы: `sessions`, `users`)
  * `GET /users`, `/users/:id/sessions`. Auth: Admin. (Таблицы: `users`, `sessions`)
  * `GET /evolution/technique-stats`, `/evolution/crisis-events`. Auth: Admin. (Таблицы: `technique_outcomes`, `crisis_events`)
  * `GET /blacklist`, `POST /blacklist`, `DELETE /blacklist/:id`. Auth: Admin. (Таблицы: `ip_blacklist`)
