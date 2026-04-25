# Tables Map

| table | local | staging | prod | used_in | legacy? |
|-------|-------|---------|------|---------|---------|
| admin_logs | Yes | No | Yes | `routes/admin.js` | No |
| admins | Yes | Yes | Yes | `routes/admin.js`, `routes/auth.js` | No |
| chat_messages | No | No | Yes | `routes/chats.js` | Yes |
| conversations | No | No | Yes | `routes/conversations.js`, `routes/chat.js` | No |
| crisis_events | No | No | Yes | `services/safetyChecker.js` | No |
| invites | Yes | Yes | Yes | `routes/auth.js`, `routes/admin.js` | No |
| ip_blacklist | Yes | No | Yes | middleware/auth | No |
| message_quota | Yes | No | Yes | `routes/chat.js` | No |
| messages | No | No | Yes | `routes/conversations.js`, `routes/chat.js` | No |
| password_reset_requests | No | No | Yes | `routes/auth.js` | No |
| prompt_suggestions | No | No | Yes | `cron/index.js` | No |
| sessions | Yes | Yes | Yes | `routes/userSessions.js`, `routes/auth.js` | No |
| technique_outcomes | No | No | Yes | `services/techniqueTracker.js` | No |
| temp_bans | No | No | Yes | `routes/auth.js`, `routes/admin.js` | No |
| token_usage | No | No | Yes | `routes/chat.js` | No |
| user_chats | No | No | Yes | `routes/chats.js` | Yes |
| user_consent | No | No | Yes | `routes/auth.js` | No |
| user_memory | No | No | Yes | `services/memoryService.js` | No |
| users | Yes | Yes | Yes | almost everywhere | No |
