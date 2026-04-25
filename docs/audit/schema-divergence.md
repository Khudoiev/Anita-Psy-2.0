# Schema Divergence

Существенное расхождение между схемами БД в разных окружениях.

## Local (7 таблиц)
Представляет собой частичную версию: `admin_logs`, `admins`, `invites`, `ip_blacklist`, `message_quota`, `sessions`, `users`. Отсутствует таблица чатов и истории переписок.

## Staging (4 таблицы)
Очень устаревшая или урезанная схема, содержащая только: `admins`, `invites`, `sessions`, `users`.

## Production (19 таблиц)
Самая полная схема (source of truth для данных):
* Содержит старые (legacy) и новые таблицы для чатов: `user_chats` / `chat_messages` (старые) и `conversations` / `messages` (новые).
* Множество дополнительных таблиц фичей: `crisis_events`, `password_reset_requests`, `prompt_suggestions`, `technique_outcomes`, `temp_bans`, `token_usage`, `user_consent`, `user_memory`.

**Вывод:** Миграции не синхронизированы. Код в prod видимо создает таблицы `if not exists` прямо в рантайме или применяет разные SQL скрипты.
