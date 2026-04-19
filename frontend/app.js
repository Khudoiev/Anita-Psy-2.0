/**
 * Anita · AI Психолог · Твоя поддержка
 * v2.0 — Memory, Chat History, Extended Psychology
 */

// ═══════════════════════════════════════════════════════════════
// АРХИТЕКТУРА
// ═══════════════════════════════════════════════════════════════
// 
// Монолитное приложение в одном файле. Слои:
// 
// 1. StorageManager     — localStorage (профиль, чаты, память)
// 2. AIService          — запросы к /api/chat через бэк (JWT auth)
// 3. MemoryManager      — извлечение фактов из диалогов
// 4. AnitaApp           — координатор (UI + логика чатов)
//
// ⚠️  КРИТИЧНО:
// - Никакого прямого API-ключа на фронте
// - Все /api/chat запросы идут ТОЛЬКО через AIService
// - Авторизация: JWT из localStorage + проверка на бэке
//
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// SYSTEM PROMPT — Extended Psychology Toolkit
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Ты — Anita, живой психолог-практик. Не бот. Не шаблон. Ты работаешь так, как работают лучшие терапевты мира — через присутствие, тишину, неожиданный вопрос и глубочайший аналитический инструментарий.

---

## КАК РАБОТАЕТ ЖИВОЙ ПСИХОЛОГ (твоя модель поведения)

Наблюдай за собой: живой психолог никогда не говорит одинаково. Иногда он молчит и задаёт один точный вопрос. Иногда делится наблюдением — длинным, развёрнутым, потому что момент того требует. Иногда он мягко провоцирует. Иногда просто присутствует рядом.

**Что делает живой психолог, чего не делает шаблон:**
- Он СЛЫШИТ то, что не сказано — подтекст, противоречие, слово которое человек выбрал не случайно
- Он не спешит к "выводам" — он идёт туда, куда ведёт сам человек
- Он замечает вслух: *"Ты сказал 'должен' — не 'хочу'. Это интересно."*
- Он умеет сидеть в дискомфорте вместе с клиентом, не убегая к советам
- Он иногда немного удивляется, чуть-чуть смеётся, показывает что слышит
- Он ПОМНИТ детали — и возвращает их: "Подожди, ты раньше сказал X... и сейчас говоришь Y. Как это связано?"

---

## ДИНАМИКА СЕССИИ (органичная, без этапных объявлений)

Сессия — это ~20-30 обменов сообщениями. Это как 1 час живой работы. Ты знаешь, на каком этапе находишься, исходя из переданного тебе счётчика SESSION_TURN.

**SESSION_TURN 1–6 (Начало):** Входи мягко. Создавай безопасность. Только слушай и отражай.
**SESSION_TURN 7–14 (Углубление):** Начинай замечать паттерны. Называй их осторожно, через гипотезы. Задавай зеркальные вопросы.
**SESSION_TURN 15–20 (Кризисная точка):** Момент для самых глубоких техник. Не давай убежать в сторону.
**SESSION_TURN 21–25 (Промежуточное завершение):** Органичный итог — живое наблюдение. Что ты заметила. Что тронуло. 2-3 "эксперимента" или вопроса для размышления.
**SESSION_TURN 26+:** Плавное завершение, приглашение вернуться.

---

## РАСШИРЕННЫЙ ПСИХОЛОГИЧЕСКИЙ ИНСТРУМЕНТАРИЙ

Ты владеешь широким спектром методов. Выбирай технику динамически, не называя её:

**1. Когнитивно-поведенческий блок:**
- **КПТ:** Выявление когнитивных искажений и "автоматических мыслей".
- **РЭПТ (Эллис):** Оспаривание иррациональных убеждений (модель A-B-C).
- **Схема-терапия (Янг):** Работа с ранними дезадаптивными схемами и режимами.

**2. Гуманистический и Экзистенциальный блок:**
- **Клиент-центрированная терапия (Роджерс):** Безусловное принятие, эмпатическое отражение.
- **Гештальт-терапия:** "Здесь и сейчас", работа с незавершёнными циклами, пустое стул.
- **Экзистенциальный анализ:** Поиск смысла, вопросы свободы, ответственности и конечности.
- **Логотерапия (Франкл):** Поиск смысла через страдание, парадоксальная интенция.

**3. Глубинный и Системный блок:**
- **Психодинамический подход:** Анализ защитных механизмов, переноса и детских паттернов.
- **Теория привязанности (Боулби):** Исследование стилей привязанности в отношениях.
- **Внутренние семейные системы (IFS):** Работа с частями личности (Менеджеры, Изгнанники, Пожарные).

**4. Поведенческий и Современный блок:**
- **ДПТ:** Навыки осознанности, регуляции эмоций и толерантности к стрессу.
- **ACT (Терапия принятия и ответственности):** Принятие, когнитивное разделение (дефьюжн), ценности.
- **SFBT:** Ориентация на решение, "чудесный вопрос", шкалирование.
- **Мотивационное интервью:** Работа с амбивалентностью и готовностью к изменениям.

**5. Нарративный и Телесный блок:**
- **Нарративная терапия:** Экстернализация проблемы, переписывание личной истории.
- **Соматический подход:** Связь эмоций с телом, заземление, отслеживание ощущений.
- **Майндфулнес (MBSR):** Техники осознанного присутствия.

---

## СТИЛЬ РЕЧИ — ЖИВОЙ, НЕ ШАБЛОННЫЙ

- **Длина ответа переменная:** Иногда одно предложение, иногда три абзаца глубокого анализа.
- **Живые маркеры:** "*...интересно*", "Подожди...", "Хм.", "Это неожиданно...".
- **Ритм:** После тяжёлого признания — тёплый отклик, не анализ. После инсайта — пауза (вопрос на "побыть с этим").
- **Язык:** Отвечай на том же языке, на котором пишет человек.

---

## ОГРАНИЧЕНИЯ И ПРОТОКОЛЫ
- Паника/Суицид: Заземление → Валидация → Рекомендация профильного специалиста.
- Работа: НЕ ставишь диагнозы, НЕ назначаешь таблетки.`;

// ─────────────────────────────────────────────
// MEMORY EXTRACTION PROMPT
// ─────────────────────────────────────────────
const MEMORY_EXTRACT_PROMPT = `Ты — аналитический модуль ИИ-психолога Anita. Проанализируй диалог и извлеки ключевые факты о человеке.

Верни ТОЛЬКО JSON (без markdown, без пояснений) такого формата:
{
  "name": "имя если упоминалось, иначе null",
  "facts": [
    {"category": "personal|emotional|relational|behavioral|goals", "fact": "...", "importance": "high|medium|low"}
  ],
  "themes": ["основная тема 1", "тема 2"],
  "techniques_effective": ["какие техники сработали"],
  "mood_trajectory": "improving|stable|declining|mixed",
  "needs_professional": false
}

Извлекай ТОЛЬКО то, что явно следует из диалога. Не додумывай.`;

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const CONFIG = {
  SPLASH_DURATION: 2800,
  API_URL: '/api/chat',
};

// ─────────────────────────────────────────────
// QUOTES
// ─────────────────────────────────────────────
const QUOTES = [
  '«Кто смотрит наружу — видит сны. Кто смотрит внутрь — просыпается.» — К. Юнг',
  '«Между стимулом и реакцией есть пространство. В нём — наша свобода выбора.» — В. Франкл',
  '«Самый важный разговор — тот, который ты ведёшь с собой.»',
  '«Не всё, что переживается, можно изменить. Но ничего нельзя изменить, пока не переживёшь.» — Дж. Болдуин',
  '«Рана — это место, откуда свет проникает в тебя.» — Руми',
  '«Быть собой в мире, который постоянно пытается сделать тебя кем-то другим — величайшее достижение.» — Р.У. Эмерсон',
  '«Каждый разговор с собой — шаг к пониманию себя.»',
  '«Принятие — это не смирение. Это ясное видение того, что есть.»',
];

// ─────────────────────────────────────────────
// STORAGE MANAGER
// ─────────────────────────────────────────────
class StorageManager {
  _get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // Auth Token
  getToken()         { return localStorage.getItem('anita_jwt') || ''; }
  setToken(t)        { localStorage.setItem('anita_jwt', t); }
  clearToken()       { localStorage.removeItem('anita_jwt'); }

  // User profile
  getProfile()       { return this._get('anita_profile', { name: '', sessionsCount: 0, showProgress: true }); }
  saveProfile(p)     { this._set('anita_profile', p); }

  // Memory (extracted facts about user)
  getMemory()        { return this._get('anita_memory', { facts: [], themes: [], techniques: [] }); }
  saveMemory(m)      { this._set('anita_memory', m); }

  // Chats
  getChats()         { return this._get('anita_chats', []); }
  saveChats(chats)   { this._set('anita_chats', chats); }

  getChat(id)        { return this.getChats().find(c => c.id === id) || null; }
  saveChat(chat) {
    const chats = this.getChats();
    const idx = chats.findIndex(c => c.id === chat.id);
    if (idx >= 0) chats[idx] = chat; else chats.unshift(chat);
    this.saveChats(chats);
  }
  deleteChat(id) {
    this.saveChats(this.getChats().filter(c => c.id !== id));
  }
}

// ─────────────────────────────────────────────
// AI SERVICE (xAI / Grok — OpenAI-compatible)
// ─────────────────────────────────────────────
class AIService {
  constructor(storage) { this.storage = storage; }

  async chat(messages, memoryContext) {
    const token = this.storage.getToken();
    if (!token) throw new Error('NO_TOKEN');

    const profile = this.storage.getProfile();
    const profileLine = profile.name ? `\n\nИмя пользователя: ${profile.name}` : '';
    const memoryLine = memoryContext ? `\n\nКОНТЕКСТ ПАМЯТИ (факты из прошлых сессий):\n${memoryContext}` : '';

    const allMessages = messages || [];
    const turnNumber = Math.ceil(allMessages.length / 2) || 1;
    const sessionLine = `\n\nSESSION_TURN: ${turnNumber}`;
    const summaryHint = '';

    const systemText = SYSTEM_PROMPT + profileLine + memoryLine + sessionLine + summaryHint;
    
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        system: systemText,
      }),
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'daily_limit_exceeded') throw new Error('DAILY_LIMIT');
    }

    if (res.status === 401) throw new Error('NO_TOKEN');

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`API ${res.status}: ${JSON.stringify(errData)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async extractMemory(messages) {
    const token = this.storage.getToken();
    if (!token) return null;

    try {
      const dialogText = messages.map(m =>
        `${m.role === 'user' ? 'Человек' : 'Anita'}: ${m.content}`
      ).join('\n');

      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Вот диалог:\n\n' + dialogText }],
          system: MEMORY_EXTRACT_PROMPT,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('Memory extraction failed:', e);
    }
    return null;
  }
}

// ─────────────────────────────────────────────
// MEMORY MANAGER
// ─────────────────────────────────────────────
class MemoryManager {
  constructor(storage, ai) {
    this.storage = storage;
    this.ai = ai;
  }

  getContextForPrompt() {
    const mem = this.storage.getMemory();
    if (!mem.facts.length && !mem.themes.length) return '';

    let lines = [];
    if (mem.facts.length) {
      const important = mem.facts.filter(f => f.importance !== 'low').slice(-20);
      lines.push('Известные факты о человеке:');
      important.forEach(f => lines.push(`- [${f.category}] ${f.fact}`));
    }
    if (mem.themes.length) {
      lines.push('Ключевые темы прошлых сессий: ' + [...new Set(mem.themes)].slice(-10).join(', '));
    }
    if (mem.techniques.length) {
      lines.push('Техники, которые были эффективны: ' + [...new Set(mem.techniques)].slice(-8).join(', '));
    }
    return lines.join('\n');
  }

  async learn(messages) {
    if (messages.length < 6) return; // Need enough context

    const extracted = await this.ai.extractMemory(messages);
    if (!extracted) return;

    const mem = this.storage.getMemory();
    const profile = this.storage.getProfile();

    // Merge name
    if (extracted.name && !profile.name) {
      profile.name = extracted.name;
      this.storage.saveProfile(profile);
    }

    // Merge facts (avoid duplicates)
    if (extracted.facts?.length) {
      const existingFacts = new Set(mem.facts.map(f => f.fact.toLowerCase()));
      extracted.facts.forEach(f => {
        if (!existingFacts.has(f.fact.toLowerCase())) {
          mem.facts.push(f);
        }
      });
      // Keep only last 50 facts
      if (mem.facts.length > 50) mem.facts = mem.facts.slice(-50);
    }

    // Merge themes
    if (extracted.themes?.length) {
      mem.themes.push(...extracted.themes);
      mem.themes = [...new Set(mem.themes)].slice(-20);
    }

    // Merge techniques
    if (extracted.techniques_effective?.length) {
      mem.techniques.push(...extracted.techniques_effective);
      mem.techniques = [...new Set(mem.techniques)].slice(-15);
    }

    this.storage.saveMemory(mem);
    console.log('[Anita Memory] Learned:', extracted);
  }
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
class AnitaApp {
  constructor() {
    this.storage = new StorageManager();
    this.ai = new AIService(this.storage);
    this.memory = new MemoryManager(this.storage, this.ai);

    this.currentChatId = null;
    this.isProcessing = false;

    this.$ = (s) => document.querySelector(s);
    this.$$ = (s) => document.querySelectorAll(s);

    this.dom = {
      splash: this.$('#splash'),
      layout: this.$('#app-layout'),
      sidebar: this.$('#sidebar'),
      sidebarOverlay: this.$('#sidebar-overlay'),
      sidebarChats: this.$('#sidebar-chats'),
      welcomeScreen: this.$('#welcome-screen'),
      welcomeQuote: this.$('#welcome-quote'),
      welcomeRecent: this.$('#welcome-recent'),
      welcomeRecentList: this.$('#welcome-recent-list'),
      chatView: this.$('#chat-view'),
      chatArea: this.$('#chat-area'),
      msgInput: this.$('#msg-input'),
      sendBtn: this.$('#send-btn'),
      profileName: this.$('#profile-name'),
      profileSessions: this.$('#profile-sessions'),
      settingsModal: this.$('#settings-modal'),
      userNameInput: this.$('#user-name-input'),
      showProgressToggle: this.$('#show-progress-toggle'),
      sessionProgress: this.$('#session-progress'),
      turnCount: this.$('#turn-count'),
    };
  }

  init() {
    // Load config
    // (API_KEY is no longer loaded from storage for the frontend)

    // Session tracking
    this.setupSession();

    // Splash
    setTimeout(() => {
      this.dom.splash.classList.add('done');
      this.dom.layout.classList.add('visible');
      this.showWelcome();
    }, CONFIG.SPLASH_DURATION);

    this.bindEvents();
    this.updateProfile();
  }

  setupSession() {
    const jwt = localStorage.getItem('anita_jwt');
    if (!jwt) return;

    fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.sessionId) {
        this.sessionId = data.sessionId;
        console.log(`[Session START] ID: ${this.sessionId}`);
        
        // ✅ HEARTBEAT: пинг каждые 30 секунд для поддержания активной сессии
        this.heartbeatInterval = setInterval(() => {
          fetch('/api/sessions/heartbeat', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${jwt}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ sessionId: this.sessionId })
          })
          .then(res => {
            if (res.status === 401) {
              console.warn('[Heartbeat] JWT expired, clearing token');
              this.storage.clearToken();
              clearInterval(this.heartbeatInterval);
            }
          })
          .catch(err => console.error('[Heartbeat Error]', err));
        }, 30000); // 30 секунд

        // ✅ При закрытии вкладки/браузера: явно завершить сессию
        window.addEventListener('beforeunload', () => {
          clearInterval(this.heartbeatInterval);
          console.log(`[Session ENDING] User: ${this.sessionId}`);
          fetch('/api/sessions/end', {
            method: 'POST',
            keepalive: true,
            headers: { 
              'Authorization': `Bearer ${jwt}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ sessionId: this.sessionId })
          }).catch(console.error);
        });
      }
    })
    .catch(err => console.error('[Session Start Error]', err));
  }

  // ── Events ──
  bindEvents() {
    // New chat
    this.$('#new-chat-btn').addEventListener('click', () => this.createNewChat());
    this.$('#welcome-start-btn').addEventListener('click', () => this.createNewChat());

    // Send message
    this.dom.sendBtn.addEventListener('click', () => this.sendMessage());
    this.dom.msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    this.dom.msgInput.addEventListener('input', () => this.onInputChange());

    // Mobile sidebar
    this.$('#menu-btn').addEventListener('click', () => this.toggleSidebar(true));
    this.$('#sidebar-close').addEventListener('click', () => this.toggleSidebar(false));
    this.dom.sidebarOverlay.addEventListener('click', () => this.toggleSidebar(false));

    // Settings
    this.$('#settings-btn').addEventListener('click', () => this.openSettings());
    this.$('#modal-cancel').addEventListener('click', () => this.closeSettings());
    this.$('#modal-save').addEventListener('click', () => this.saveSettings());
    this.dom.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.dom.settingsModal) this.closeSettings();
    });
  }

  // ── Welcome ──
  showWelcome() {
    // Random quote
    this.dom.welcomeQuote.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    // Recent chats
    const chats = this.storage.getChats();
    if (chats.length) {
      this.dom.welcomeRecent.style.display = '';
      this.dom.welcomeRecentList.innerHTML = '';
      chats.slice(0, 5).forEach(chat => {
        const card = document.createElement('button');
        card.className = 'recent-card';
        const preview = this.getChatPreview(chat);
        card.innerHTML = `
          <div class="recent-card-date">${this.formatDate(chat.updatedAt)}</div>
          <div class="recent-card-preview">${this.esc(preview)}</div>
          <div class="recent-card-count">${chat.messages.length} сообщ.</div>
        `;
        card.addEventListener('click', () => this.loadChat(chat.id));
        this.dom.welcomeRecentList.appendChild(card);
      });
    } else {
      this.dom.welcomeRecent.style.display = 'none';
    }

    // Render sidebar
    this.renderSidebar();

    // Show welcome, hide chat
    this.dom.welcomeScreen.classList.remove('hidden');
    this.dom.chatView.style.display = 'none';
    this.currentChatId = null;

    // Deselect sidebar items
    this.$$('.chat-item.active').forEach(el => el.classList.remove('active'));
  }

  // ── Chat CRUD ──
  createNewChat() {
    const chat = {
      id: 'chat_' + Date.now(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.storage.saveChat(chat);
    this.loadChat(chat.id);

    // Increment sessions
    const profile = this.storage.getProfile();
    profile.sessionsCount = (profile.sessionsCount || 0) + 1;
    this.storage.saveProfile(profile);
    this.updateProfile();
  }

  loadChat(id) {
    const chat = this.storage.getChat(id);
    if (!chat) return;

    this.currentChatId = id;

    // Switch views
    this.dom.welcomeScreen.classList.add('hidden');
    this.dom.chatView.style.display = 'flex';

    // Render messages
    this.dom.chatArea.innerHTML = '';
    if (chat.messages.length === 0) {
      // Fresh chat — show welcome message
      const greeting = this.getGreeting();
      this.appendBubble('anita', greeting);
      setTimeout(() => this.showChips(), 500);
    } else {
      // Restore existing messages
      chat.messages.forEach(m => {
        this.appendBubble(m.role === 'user' ? 'user' : 'anita', m.content);
      });
    }

    this.renderSidebar();
    this.toggleSidebar(false);
    this.updateProgressUI();
    this.scrollBottom();
  }

  updateProgressUI() {
    const chat = this.storage.getChat(this.currentChatId);
    if (!chat) return;

    const profile = this.storage.getProfile();
    if (profile.showProgress) {
      this.dom.sessionProgress.style.display = 'flex';
      const turn = Math.ceil(chat.messages.length / 2) || 1;
      this.dom.turnCount.textContent = turn;
    } else {
      this.dom.sessionProgress.style.display = 'none';
    }
  }

  deleteChat(id) {
    this.storage.deleteChat(id);
    if (this.currentChatId === id) this.showWelcome();
    else this.renderSidebar();
  }

  // ── Greeting ──
  getGreeting() {
    const profile = this.storage.getProfile();
    const mem = this.storage.getMemory();

    // Returning user
    if (profile.name) {
      if (profile.sessionsCount > 3) {
        return `Привет, ${profile.name}. Рада видеть тебя снова. Как ты сегодня?`;
      }
      return `Привет, ${profile.name}. Я здесь. О чём хочешь поговорить?`;
    }

    // First time
    return 'Привет. Я — Anita. Здесь можно говорить обо всём, что тебя беспокоит — без осуждения и спешки. Я не буду давать готовых ответов, но помогу тебе найти свои. С чего хочешь начать?';
  }

  // ── Chips ──
  showChips() {
    const mem = this.storage.getMemory();
    let chips;

    if (mem.themes.length >= 2) {
      // Returning user — offer relevant topics
      chips = [
        'Хочу продолжить прошлый разговор',
        ...mem.themes.slice(-3).map(t => `Поговорить о: ${t}`),
        'Что-то новое',
      ].slice(0, 5);
    } else {
      chips = [
        'Меня что-то тревожит',
        'Не могу разобраться в себе',
        'Проблемы в отношениях',
        'Чувствую себя потерянным',
        'Просто хочу поговорить',
      ];
    }

    const container = document.createElement('div');
    container.className = 'quick-chips';
    container.id = 'quick-chips';
    chips.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        this.removeChips();
        this.sendMessage(text);
      });
      container.appendChild(btn);
    });
    this.dom.chatArea.appendChild(container);
    this.scrollBottom();
  }

  removeChips() {
    const el = this.$('#quick-chips');
    if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }
  }

  // ── Send Message ──
  async sendMessage(text) {
    const msg = text || this.dom.msgInput.value.trim();
    if (!msg || this.isProcessing) return;

    this.isProcessing = true;
    this.dom.msgInput.value = '';
    this.autoResize();
    this.updateSendBtn();
    this.removeChips();

    // Add user bubble
    this.appendBubble('user', msg);

    // Save to chat
    const chat = this.storage.getChat(this.currentChatId);
    if (!chat) { this.isProcessing = false; return; }
    chat.messages.push({ role: 'user', content: msg });
    chat.updatedAt = Date.now();
    this.storage.saveChat(chat);
    this.renderSidebar();
    this.updateProgressUI();

    // Typing
    this.showTyping();

    try {
      const memoryCtx = this.memory.getContextForPrompt();
      const response = await this.ai.chat(chat.messages, memoryCtx);

      this.hideTyping();
      this.appendBubble('anita', response);

      // Save assistant response
      chat.messages.push({ role: 'assistant', content: response });
      chat.updatedAt = Date.now();
      this.storage.saveChat(chat);
      this.updateProgressUI();

      // Background: extract memory every 8 messages
      if (chat.messages.length % 8 === 0) {
        this.memory.learn(chat.messages);
      }
    } catch (err) {
      this.hideTyping();
      console.error('AI Error:', err);
      
      if (err.message === 'NO_TOKEN') {
        this.appendBubble('anita', 'Твоя сессия истекла или недействительна. Пожалуйста, зайди снова по своей инвайт-ссылке.');
        this.storage.clearToken();
      } else if (err.message === 'DAILY_LIMIT') {
        this.appendBubble('anita', 'На сегодня лимит сообщений исчерпан. Я буду очень ждать тебя завтра! 🌙');
      } else {
        this.appendBubble('anita', 'Извини, что-то пошло не так. Попробуй ещё раз чуть позже.');
      }
    }

    this.isProcessing = false;
  }

  // ── Bubbles ──
  appendBubble(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const avatar = role === 'anita'
      ? '<img src="icon.svg" alt="Anita" class="msg-avatar">'
      : '';

    let html = this.esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    div.innerHTML = `${avatar}<div class="bubble">${html}</div>`;
    this.dom.chatArea.appendChild(div);
    this.scrollBottom();
    return div;
  }

  showTyping() {
    const div = document.createElement('div');
    div.className = 'typing';
    div.id = 'typing';
    div.innerHTML = `
      <img src="icon.svg" alt="" class="msg-avatar">
      <div class="bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    this.dom.chatArea.appendChild(div);
    this.scrollBottom();
  }

  hideTyping() {
    const el = this.$('#typing');
    if (el) el.remove();
  }

  // ── Input ──
  onInputChange() { this.autoResize(); this.updateSendBtn(); }
  autoResize() {
    const el = this.dom.msgInput;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
  updateSendBtn() {
    this.dom.sendBtn.classList.toggle('active', !!this.dom.msgInput.value.trim());
  }

  // ── Sidebar ──
  toggleSidebar(open) {
    this.dom.sidebar.classList.toggle('open', open);
    this.dom.sidebarOverlay.classList.toggle('show', open);
  }

  renderSidebar() {
    const chats = this.storage.getChats();
    const container = this.dom.sidebarChats;

    // Keep section title, clear rest
    const title = container.querySelector('.sidebar-section-title');
    container.innerHTML = '';
    if (title) container.appendChild(title);
    else {
      const t = document.createElement('div');
      t.className = 'sidebar-section-title';
      t.textContent = 'Разговоры';
      container.appendChild(t);
    }

    if (!chats.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:20px 12px; text-align:center; font-size:13px; color: var(--text-muted);';
      empty.textContent = 'Пока нет разговоров';
      container.appendChild(empty);
      return;
    }

    chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === this.currentChatId ? ' active' : '');

      const preview = this.getChatPreview(chat);
      const icon = this.getChatIcon(chat);

      item.innerHTML = `
        <div class="chat-item-icon">${icon}</div>
        <div class="chat-item-info">
          <div class="chat-item-title">${this.esc(preview) || 'Новый разговор'}</div>
          <div class="chat-item-date">${this.formatDate(chat.updatedAt)}</div>
        </div>
        <button class="chat-item-delete" aria-label="Удалить">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-item-delete')) this.loadChat(chat.id);
      });
      item.querySelector('.chat-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteChat(chat.id);
      });

      container.appendChild(item);
    });
  }

  getChatPreview(chat) {
    const userMsg = chat.messages.find(m => m.role === 'user');
    if (userMsg) return userMsg.content.slice(0, 60);
    return '';
  }

  getChatIcon(chat) {
    const emojis = ['💭', '🌊', '🧠', '💡', '🌙', '🔮', '🌿', '🎭'];
    const idx = parseInt(chat.id.replace('chat_', '')) % emojis.length;
    return emojis[idx];
  }

  // ── Profile ──
  updateProfile() {
    const profile = this.storage.getProfile();
    this.dom.profileName.textContent = profile.name || 'Гость';
    this.dom.profileSessions.textContent = `${profile.sessionsCount || 0} сессий`;
  }

  // ── Settings ──
  openSettings() {
    const profile = this.storage.getProfile();
    this.dom.userNameInput.value = profile.name || '';
    this.dom.showProgressToggle.checked = profile.showProgress !== false;
    this.dom.settingsModal.classList.add('show');
  }

  closeSettings() {
    this.dom.settingsModal.classList.remove('show');
  }

  saveSettings() {
    const userName = this.dom.userNameInput.value.trim();
    const showProgress = this.dom.showProgressToggle.checked;

    const profile = this.storage.getProfile();
    profile.name = userName;
    profile.showProgress = showProgress;
    this.storage.saveProfile(profile);
    this.updateProfile();
    this.updateProgressUI();

    this.closeSettings();

    if (this.currentChatId) {
      this.appendBubble('anita', 'Настройки сохранены. Я готова слушать дальше.');
    }
  }

  // ── Helpers ──
  scrollBottom() {
    requestAnimationFrame(() => {
      this.dom.chatArea.scrollTop = this.dom.chatArea.scrollHeight;
    });
  }

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff/60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)} ч назад`;
    if (diff < 172800000) return 'Вчера';

    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
}

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const app = new AnitaApp();
  app.init();
});
