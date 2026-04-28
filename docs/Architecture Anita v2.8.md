┌─────────────────────────────────────────────────────────────────────────┐
│                            ПОЛЬЗОВАТЕЛЬ                                  │
└───────────────┬─────────────────────────────────┬───────────────────────┘
                │                                 │
        ┌───────▼────────┐                ┌───────▼────────┐
        │  frontend/     │                │   admin/       │
        │  (vanilla JS)  │                │  (vanilla JS)  │
        │  index.html    │                │  index.html    │
        │  app.js        │                │  tabs/панели   │
        │  index.css     │                │                │
        └───────┬────────┘                └───────┬────────┘
                │                                 │
                │  HTTP/SSE (JWT в localStorage)  │
                │                                 │
        ┌───────▼─────────────────────────────────▼────────┐
        │                   NGINX                           │
        │  443 → фронт  |  8443 → админка  |  /api → прокси │
        └───────────────────────┬──────────────────────────┘
                                │
                ┌───────────────▼──────────────┐
                │      backend/ (Express)       │
                │      server.js :4000          │
                │                               │
                │  Routes:                      │
                │    /api/auth           (login, register, consent, delete-me) │
                │    /api/chat           (POST — обычный, /stream — SSE)       │
                │    /api/chats          (список чатов + сообщения)            │
                │    /api/conversations  (новая схема разговоров)              │
                │    /api/sessions       (user sessions)                       │
                │    /api/admin/*        (invites, blacklist, logs,            │
                │                         evolution: suggestions/crisis/stats) │
                │                                                              │
                │  Middleware: requireAuth, checkBlacklist                     │
                │                                                              │
                │  Services:                                                   │
                │    memoryService      — факты о юзере в user_memory          │
                │    safetyChecker      — crisis detection                     │
                │    techniqueTracker   — regex детект техник (CBT, ACT, ...)  │
                │    promptEvolution    — генерит suggestions раз в неделю    │
                │    tokenTracker       — учёт токенов                         │
                │    contextManager     — окно контекста для LLM               │
                │                                                              │
                │  Cron: purge сообщений / churn / suggestions                 │
                │                                                              │
                │  Prompts: anita.js (базовый системный промпт)                │
                └───────────┬───────────────────────┬──────────┘
                            │                       │
                            ▼                       ▼
                ┌───────────────────┐     ┌────────────────────┐
                │  xAI Grok API     │     │  PostgreSQL 15     │
                │  grok-3-mini-fast │     │  external volume   │
                │  (streaming SSE)  │     │  anitapsy_postgres │
                └───────────────────┘     └────────────────────┘

Окружения:
  • local (docker-compose.override.yml)  :80 / :4000
  • staging локальный (8080/4001)         — для тебя на ноуте
  • staging серверный (34.140.213.8:8081) — на VPS
  • production (anita-psy.online :443 / :8443)