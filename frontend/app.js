/**
 * Anita · AI Психолог · Твоя поддержка
 * v2.0 — Memory, Chat History, Extended Psychology
 */

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const CONFIG = {
  SPLASH_DURATION: 2800,
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
// Гибридный: JWT + UI-настройки → localStorage
// Чаты, память → API (БД, зашифровано)
// ─────────────────────────────────────────────
class StorageManager {
  // ── localStorage (только нечувствительное) ──

  getToken()      { return localStorage.getItem('anita_jwt') || ''; }
  clearToken()    { localStorage.removeItem('anita_jwt'); }

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) ?? fallback;
    } catch { return fallback; }
  }

  // UI-настройки: имя для приветствия, showProgress
  getProfile()    { return this._get('anita_profile', { name: '', showProgress: true }); }
  saveProfile(p)  { localStorage.setItem('anita_profile', JSON.stringify(p)); }

  // In-memory кэш для текущей сессии (не персистентный)
  // Чаты загружаются с сервера, здесь только кэш
  _chatsCache   = [];   // [{ id, title, message_count, updated_at }]
  _messagesCache = {};  // { chatId: [{ role, content }] }
  _memoryCache  = null; // { facts, themes, techniques, name_hint }

  // ── API-методы (возвращают Promise) ──────────

  authHeaders() {
    const t = this.getToken();
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  }

  async apiFetch(method, path, body) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: this.authHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) { this.clearToken(); window.location.href = '/auth.html'; return null; }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
    return res.json();
  }

  // ── Список чатов ──────────────────────────────

  async fetchChats() {
    const data = await this.apiFetch('GET', '/chats');
    this._chatsCache = data || [];
    return this._chatsCache;
  }

  getChatsCache()   { return this._chatsCache; }

  async createChat(title) {
    const chat = await this.apiFetch('POST', '/chats', { title: title || 'Новый разговор' });
    if (chat) {
      chat.messages = [];
      this._chatsCache.unshift(chat);
      this._messagesCache[chat.id] = [];
    }
    return chat;
  }

  async deleteChat(id) {
    await this.apiFetch('DELETE', `/chats/${id}`);
    this._chatsCache = this._chatsCache.filter(c => c.id !== id);
    delete this._messagesCache[id];
  }

  // ── Сообщения ────────────────────────────────

  async fetchMessages(chatId) {
    const data = await this.apiFetch('GET', `/chats/${chatId}`);
    if (!data) return [];
    this._messagesCache[chatId] = data.messages || [];
    // Обновляем кэш чатов
    const idx = this._chatsCache.findIndex(c => c.id === chatId);
    if (idx >= 0) Object.assign(this._chatsCache[idx], data.chat);
    return this._messagesCache[chatId];
  }

  getMessagesCache(chatId) { return this._messagesCache[chatId] || []; }

  async saveMessage(chatId, role, content) {
    const msg = await this.apiFetch('POST', `/chats/${chatId}/messages`, { role, content });
    if (msg) {
      if (!this._messagesCache[chatId]) this._messagesCache[chatId] = [];
      this._messagesCache[chatId].push({ role, content, created_at: msg.created_at });
      // Обновляем updated_at в кэше чатов
      const idx = this._chatsCache.findIndex(c => c.id === chatId);
      if (idx >= 0) {
        this._chatsCache[idx].updated_at = msg.created_at || new Date().toISOString();
        this._chatsCache[idx].message_count = (this._chatsCache[idx].message_count || 0) + 1;
        // Обновляем title если это первое сообщение юзера
        if (role === 'user' && (!this._chatsCache[idx].title || this._chatsCache[idx].title === 'Новый разговор')) {
          this._chatsCache[idx].title = content.slice(0, 80);
        }
      }
    }
    return msg;
  }

  // ── Память Anita ──────────────────────────────

  async fetchMemory() {
    const data = await this.apiFetch('GET', '/memory');
    this._memoryCache = data || { facts: [], themes: [], techniques: [], name_hint: null };
    // Синхронизируем name_hint с профилем
    if (this._memoryCache.name_hint) {
      const profile = this.getProfile();
      if (!profile.name) { profile.name = this._memoryCache.name_hint; this.saveProfile(profile); }
    }
    return this._memoryCache;
  }

  getMemoryCache() {
    return this._memoryCache || { facts: [], themes: [], techniques: [] };
  }

  async saveMemory(mem) {
    this._memoryCache = mem;
    // Fire-and-forget — не блокируем UI
    this.apiFetch('POST', '/memory', mem).catch(e => console.warn('[Memory save]', e));
  }
}

// ─────────────────────────────────────────────
// AI SERVICE — всё через бэкенд /api/chat
// Ключ xAI хранится только на сервере в .env
// ─────────────────────────────────────────────
class AIService {
  constructor(storage) { this.storage = storage; }

  async chat(messages, conversationId, signal) {
    const token = this.storage.getToken();
    if (!token) throw new Error('NO_TOKEN');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        conversationId,
      }),
      signal,
    });

    if (res.status === 401) { this.storage.clearToken(); throw new Error('NO_TOKEN'); }
    if (res.status === 429) {
      const d = await res.json().catch(() => ({}));
      if (d.error === 'daily_limit_exceeded') throw new Error('DAILY_LIMIT');
    }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async streamChat(messages, conversationId, onToken, onComplete, signal) {
    const token = this.storage.getToken();
    if (!token) throw new Error('NO_TOKEN');

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, conversationId }),
      signal,
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'daily_limit_exceeded') throw new Error('DAILY_LIMIT');
    }
    if (res.status === 401) throw new Error('NO_TOKEN');
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { onComplete(); return; }
        try {
          const { token: tok } = JSON.parse(data);
          if (tok) onToken(tok);
        } catch {}
      }
    }
  }

  async extractMemory(messages) {
    const token = this.storage.getToken();
    if (!token) return null;
    try {
      const dialogText = messages.map(m =>
        `${m.role === 'user' ? 'Человек' : 'Anita'}: ${m.content}`
      ).join('\n');

      const res = await fetch('/api/chat/extract-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dialog: dialogText }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || data.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) { console.warn('[Memory extract]', e); }
    return null;
  }
}

// ─────────────────────────────────────────────
// MEMORY MANAGER — читает/пишет через API
// ─────────────────────────────────────────────
class MemoryManager {
  constructor(storage, ai) {
    this.storage = storage;
    this.ai = ai;
  }

  getContextForPrompt() {
    const mem = this.storage.getMemoryCache();
    if (!mem.facts?.length && !mem.themes?.length) return '';

    const lines = [];
    if (mem.facts?.length) {
      const important = mem.facts.filter(f => f.importance !== 'low').slice(-20);
      lines.push('Известные факты о человеке:');
      important.forEach(f => lines.push(`- [${f.category}] ${f.fact}`));
    }
    if (mem.themes?.length) {
      lines.push('Ключевые темы прошлых сессий: ' + [...new Set(mem.themes)].slice(-10).join(', '));
    }
    if (mem.techniques?.length) {
      lines.push('Техники, которые были эффективны: ' + [...new Set(mem.techniques)].slice(-8).join(', '));
    }
    return lines.join('\n');
  }

  async learn(messages) {
    if (messages.length < 6) return;
    const extracted = await this.ai.extractMemory(messages);
    if (!extracted) return;

    const mem = { ...this.storage.getMemoryCache() };
    const profile = this.storage.getProfile();

    // Имя — сохраняем и в профиль (UI) и в память (БД)
    if (extracted.name) {
      if (!profile.name) { profile.name = extracted.name; this.storage.saveProfile(profile); }
      mem.name_hint = extracted.name;
    }

    // Факты
    if (extracted.facts?.length) {
      const existing = new Set((mem.facts || []).map(f => f.fact.toLowerCase()));
      extracted.facts.forEach(f => {
        if (!existing.has(f.fact.toLowerCase())) mem.facts = [...(mem.facts || []), f];
      });
      if (mem.facts.length > 50) mem.facts = mem.facts.slice(-50);
    }

    // Темы
    if (extracted.themes?.length) {
      mem.themes = [...new Set([...(mem.themes || []), ...extracted.themes])].slice(-20);
    }

    // Техники
    if (extracted.techniques_effective?.length) {
      mem.techniques = [...new Set([...(mem.techniques || []), ...extracted.techniques_effective])].slice(-15);
    }

    mem.mood_trajectory = extracted.mood_trajectory || mem.mood_trajectory;

    await this.storage.saveMemory(mem);
    console.log('[Anita Memory] Saved to DB:', extracted);
  }
}

// ─────────────────────────────────────────────
// APP — координатор UI + логика чатов v3.0
// Все данные через API, localStorage только для JWT + UI
// ─────────────────────────────────────────────
class AnitaApp {
  constructor() {
    this.storage = new StorageManager();
    this.ai      = new AIService(this.storage);
    this.memory  = new MemoryManager(this.storage, this.ai);

    this.currentChatId = null;
    this.isProcessing  = false;
    this.abortController = null;
    this.streamBuffer = '';

    this.$ = (s) => document.querySelector(s);
    this.$$ = (s) => document.querySelectorAll(s);

    this.dom = {
      splash:             this.$('#splash'),
      layout:             this.$('#app-layout'),
      sidebar:            this.$('#sidebar'),
      sidebarOverlay:     this.$('#sidebar-overlay'),
      sidebarChats:       this.$('#sidebar-chats'),
      welcomeScreen:      this.$('#welcome-screen'),
      welcomeQuote:       this.$('#welcome-quote'),
      welcomeRecent:      this.$('#welcome-recent'),
      welcomeRecentList:  this.$('#welcome-recent-list'),
      chatView:           this.$('#chat-view'),
      chatArea:           this.$('#chat-area'),
      msgInput:           this.$('#msg-input'),
      sendBtn:            this.$('#send-btn'),
      profileName:        this.$('#profile-name'),
      profileSessions:    this.$('#profile-sessions'),
      sidebarAuthLinks:   this.$('#sidebar-auth-links'),
      settingsModal:      this.$('#settings-modal'),
      userNameInput:      this.$('#user-name-input'),
      showProgressToggle: this.$('#show-progress-toggle'),
      sessionProgress:    this.$('#session-progress'),
      turnCount:          this.$('#turn-count'),
    };
  }

  // ══════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════
  async init() {
    if (!this.storage.getToken()) {
      window.location.href = '/auth.html' + window.location.search;
      return;
    }

    this.setupSession();
    this.bindEvents();

    // Сплэш → загрузка данных → welcome
    console.log('[Anita] Initializing app components...');
    setTimeout(async () => {
      if (this.dom.splash) this.dom.splash.classList.add('done');
      if (this.dom.layout) this.dom.layout.classList.add('visible');

      try {
        console.log('[Anita] Loading persistent data...');
        await Promise.all([
          this.storage.fetchMemory().catch(e => console.warn('Memory fetch failed', e)),
          this.storage.fetchChats().catch(e => console.warn('Chats fetch failed', e)),
        ]);
      } catch (e) {
        console.warn('[Init load error]', e);
      }

      this.updateProfile();
      this.showWelcome();
      console.log('[Anita] App ready.');
    }, CONFIG.SPLASH_DURATION);
  }

  // ══════════════════════════════════════════
  // SESSION TRACKING (heartbeat)
  // ══════════════════════════════════════════
  setupSession() {
    const jwt = this.storage.getToken();
    if (!jwt) return;

    fetch('/api/sessions/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      if (!data.sessionId) return;
      this.sessionId = data.sessionId;

      this.heartbeatInterval = setInterval(() => {
        fetch('/api/sessions/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId })
        }).then(r => {
          if (r.status === 401) {
            this.storage.clearToken();
            clearInterval(this.heartbeatInterval);
          }
        }).catch(() => {});
      }, 30000);

      window.addEventListener('beforeunload', () => {
        clearInterval(this.heartbeatInterval);
        fetch('/api/sessions/end', {
          method: 'POST', keepalive: true,
          headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId })
        });
        if (this.currentChatId) {
          fetch(`/api/conversations/${this.currentChatId}/end`, {
            method: 'POST', keepalive: true,
            headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
          });
        }
      });
    })
    .catch(e => console.warn('[Session start]', e));
  }

  // ══════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════
  bindEvents() {
    const bind = (id, event, fn) => {
      const el = id.startsWith('#') ? this.$(id) : id;
      if (el) el.addEventListener(event, fn);
      else console.warn(`[Anita] Could not bind ${event} to missing element: ${id}`);
    };

    bind('#new-chat-btn', 'click', () => this.createNewChat());
    bind('#welcome-start-btn', 'click', () => this.createNewChat());

    const stopBtn = this.$('#stop-btn');
    if (stopBtn) bind(stopBtn, 'click', () => this.stopGeneration());

    if (this.dom.sendBtn) bind(this.dom.sendBtn, 'click', () => this.sendMessage());
    
    if (this.dom.msgInput) {
      bind(this.dom.msgInput, 'keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
      });
      bind(this.dom.msgInput, 'input', () => this.onInputChange());
    }

    bind('#menu-btn', 'click', () => this.toggleSidebar(true));
    bind('#sidebar-close', 'click', () => this.toggleSidebar(false));
    
    if (this.dom.sidebarOverlay) bind(this.dom.sidebarOverlay, 'click', () => this.toggleSidebar(false));

    bind('#settings-btn', 'click', () => this.openSettings());
    bind('#modal-cancel', 'click', () => this.closeSettings());
    bind('#modal-save', 'click', () => this.saveSettings());
    
    if (this.dom.settingsModal) {
      bind(this.dom.settingsModal, 'click', e => {
        if (e.target === this.dom.settingsModal) this.closeSettings();
      });
    }

    bind('#end-session-btn', 'click', () => this.endSession());
    bind('#insights-skip-btn', 'click', () => { this.$('#insights-modal').classList.remove('visible'); });
    bind('#insights-save-btn', 'click', () => this.saveInsights());
  }

  // ══════════════════════════════════════════
  // INSIGHTS & END SESSION
  // ══════════════════════════════════════════
  endSession() {
    if (!this.currentChatId) return;
    const btn = this.$('#end-session-btn');
    if (btn) btn.textContent = 'Анализирую...';
    
    fetch(`/api/conversations/${this.currentChatId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.storage.getToken()}` }
    })
    .then(r => r.json())
    .then(data => {
      if (btn) btn.textContent = 'Завершить сеанс';
      if (data.insights && data.insights.length > 0) {
        this.showInsightsModal(data.insights);
      } else {
        // Just show a gentle message
        this.appendBubble('anita', 'Спасибо за разговор. Хорошего отдыха.');
      }
    })
    .catch(e => {
      console.error(e);
      if (btn) btn.textContent = 'Завершить сеанс';
    });
  }

  showInsightsModal(insights) {
    const list = this.$('#insights-list');
    if (!list) return;
    list.innerHTML = '';
    insights.forEach((ins, i) => {
       list.innerHTML += `
         <div class="insight-card" data-index="${i}" style="background:var(--bg-secondary); padding:12px; border-radius:8px; border: 1px solid var(--border);">
           <div style="font-weight:bold; margin-bottom:5px; color:var(--text-primary);">${this.esc(ins.title)}</div>
           <div style="font-size:14px; opacity:0.8; margin-bottom:12px; color:var(--text-secondary);">${this.esc(ins.description)}</div>
           <div style="display:flex; gap:15px; font-size:13px;">
             <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
               <input type="radio" name="insight_${i}" value="yes" checked> ✓ Согласен, сохранить
             </label>
             <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
               <input type="radio" name="insight_${i}" value="no"> ✗ Не про меня
             </label>
           </div>
         </div>
       `;
    });
    this.currentInsights = insights;
    this.$('#insights-modal').classList.add('visible');
  }

  saveInsights() {
    if (!this.currentInsights) return;
    const approved = [];
    const cards = this.$$('.insight-card');
    cards.forEach(card => {
       const i = card.getAttribute('data-index');
       const radio = card.querySelector(`input[name="insight_${i}"]:checked`);
       if (radio && radio.value === 'yes') {
          approved.push(this.currentInsights[i]);
       }
    });

    const btn = this.$('#insights-save-btn');
    if (btn) btn.textContent = 'Сохраняю...';

    fetch(`/api/conversations/${this.currentChatId}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.storage.getToken()}` },
      body: JSON.stringify({ approved })
    }).then(() => {
      this.$('#insights-modal').classList.remove('visible');
      if (btn) btn.textContent = 'Сохранить выбранное';
      this.appendBubble('anita', 'Я сохранила эти наблюдения. Можем вернуться к ним в следующий раз.');
    }).catch(() => {
      if (btn) btn.textContent = 'Сохранить выбранное';
      this.$('#insights-modal').classList.remove('visible');
    });
  }

  // ══════════════════════════════════════════
  // WELCOME SCREEN
  // ══════════════════════════════════════════
  showWelcome() {
    this.dom.welcomeQuote.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    const chats = this.storage.getChatsCache();
    if (chats.length) {
      this.dom.welcomeRecent.style.display = '';
      this.dom.welcomeRecentList.innerHTML = '';
      chats.slice(0, 5).forEach(chat => {
        const card = document.createElement('button');
        card.className = 'recent-card';
        card.innerHTML = `
          <div class="recent-card-date">${this.formatDate(chat.updated_at)}</div>
          <div class="recent-card-preview">${this.esc(chat.title || 'Новый разговор')}</div>
          <div class="recent-card-count">${chat.message_count || 0} сообщ.</div>
        `;
        card.addEventListener('click', () => this.loadChat(chat.id));
        this.dom.welcomeRecentList.appendChild(card);
      });
    } else {
      this.dom.welcomeRecent.style.display = 'none';
    }

    this.renderSidebar();
    this.dom.welcomeScreen.classList.remove('hidden');
    this.dom.chatView.style.display = 'none';
    this.currentChatId = null;
    this.$$('.chat-item.active').forEach(el => el.classList.remove('active'));
  }

  // ══════════════════════════════════════════
  // CHAT CRUD — все операции async через API
  // ══════════════════════════════════════════
  async createNewChat() {
    try {
      const chat = await this.storage.createChat('Новый разговор');
      if (!chat) return;

      // Обновляем счётчик сессий в профиле
      const profile = this.storage.getProfile();
      profile.sessionsCount = (profile.sessionsCount || 0) + 1;
      this.storage.saveProfile(profile);
      this.updateProfile();

      await this.loadChat(chat.id);
    } catch (e) {
      console.error('[createNewChat]', e);
    }
  }

  async loadChat(id) {
    this.currentChatId = id;

    // Переключаем вид
    this.dom.welcomeScreen.classList.add('hidden');
    this.dom.chatView.style.display = 'flex';
    this.dom.chatArea.innerHTML = '';

    // Показываем скелетон пока грузим
    this.showLoadingSkeleton();

    try {
      const messages = await this.storage.fetchMessages(id);
      this.dom.chatArea.innerHTML = '';

      if (messages.length === 0) {
        // Новый чат — приветствие + чипы
        this.appendBubble('anita', this.getGreeting());
        setTimeout(() => this.showChips(), 400);
      } else {
        // Восстанавливаем историю из БД
        messages.forEach(m => this.appendBubble(m.role, m.content));
      }
    } catch (e) {
      this.dom.chatArea.innerHTML = '';
      this.appendBubble('anita', 'Не удалось загрузить историю. Попробуй обновить страницу.');
      console.error('[loadChat]', e);
    }

    this.renderSidebar();
    this.toggleSidebar(false);
    this.updateProgressUI();
    this.scrollBottom();
  }

  async deleteChat(id) {
    try {
      await this.storage.deleteChat(id);
      if (this.currentChatId === id) this.showWelcome();
      else this.renderSidebar();
    } catch (e) {
      console.error('[deleteChat]', e);
    }
  }

  showLoadingSkeleton() {
    const sk = document.createElement('div');
    sk.id = 'chat-skeleton';
    sk.style.cssText = 'padding:20px;opacity:0.4;';
    sk.innerHTML = `
      <div style="height:16px;background:var(--bg-card);border-radius:8px;width:60%;margin-bottom:12px;"></div>
      <div style="height:16px;background:var(--bg-card);border-radius:8px;width:80%;margin-bottom:12px;margin-left:auto;"></div>
      <div style="height:16px;background:var(--bg-card);border-radius:8px;width:50%;margin-bottom:12px;"></div>
    `;
    this.dom.chatArea.appendChild(sk);
  }

  // ══════════════════════════════════════════
  // ПРОГРЕСС СЕССИИ
  // ══════════════════════════════════════════
  updateProgressUI() {
    const messages = this.storage.getMessagesCache(this.currentChatId);
    const profile  = this.storage.getProfile();

    if (profile.showProgress !== false && this.dom.sessionProgress) {
      this.dom.sessionProgress.style.display = 'flex';
      const turn = Math.ceil(messages.length / 2) || 1;
      this.dom.turnCount.textContent = turn;
    } else if (this.dom.sessionProgress) {
      this.dom.sessionProgress.style.display = 'none';
    }
  }

  // ══════════════════════════════════════════
  // GREETING
  // ══════════════════════════════════════════
  getGreeting() {
    const profile = this.storage.getProfile();
    const mem     = this.storage.getMemoryCache();

    if (profile.name) {
      const sessions = profile.sessionsCount || 0;
      if (sessions > 5) return `${profile.name}. Рада видеть тебя снова. Как ты?`;
      if (sessions > 2) return `Привет, ${profile.name}. Я здесь. О чём сегодня?`;
      return `Привет, ${profile.name}. С чего хочешь начать?`;
    }

    if (mem.themes?.length >= 2) {
      return 'С возвращением. Я помню наши прошлые разговоры. Как ты сейчас?';
    }

    return 'Привет. Я — Anita. Здесь можно говорить обо всём, что тебя беспокоит — без осуждения и спешки. С чего хочешь начать?';
  }

  // ══════════════════════════════════════════
  // CHIPS — быстрые подсказки
  // ══════════════════════════════════════════
  showChips() {
    const mem = this.storage.getMemoryCache();
    let chips;

    if (mem.themes?.length >= 2) {
      chips = [
        'Хочу продолжить прошлый разговор',
        ...mem.themes.slice(-2).map(t => `Поговорить о: ${t}`),
        'Что-то новое',
      ].slice(0, 4);
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
      btn.addEventListener('click', () => { this.removeChips(); this.sendMessage(text); });
      container.appendChild(btn);
    });
    this.dom.chatArea.appendChild(container);
    this.scrollBottom();
  }

  removeChips() {
    const el = this.$('#quick-chips');
    if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }
  }

  // ══════════════════════════════════════════
  // SEND MESSAGE — streaming via SSE
  // ══════════════════════════════════════════
  async sendMessage(text) {
    const msg = text || this.dom.msgInput.value.trim();
    if (!msg || this.isProcessing) return;

    this.isProcessing = true;
    this.dom.msgInput.value = '';
    this.autoResize();
    this.updateSendBtn();
    this.removeChips();

    // Show stop button
    const stopBtn = this.$('#stop-btn');
    const sendBtn = this.dom.sendBtn;
    if (stopBtn) { stopBtn.style.display = ''; sendBtn.style.display = 'none'; }

    try {
      this.appendBubble('user', msg);
      const messages = this.storage.getMessagesCache(this.currentChatId);
      messages.push({ role: 'user', content: msg });
      this.storage.saveMessage(this.currentChatId, 'user', msg).catch(console.warn);
      this.renderSidebar();
      this.updateProgressUI();
      this.showTyping();

      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();

      this.startStreamingBubble();

      let fullResponse = '';
      await this.streamWithRetry(
        messages,
        this.currentChatId,
        (token) => {
          fullResponse += token;
          this.appendStreamToken(token);
        },
        () => {},
        this.abortController.signal
      );

      this.finalizeStreamingBubble();

      if (fullResponse) {
        messages.push({ role: 'assistant', content: fullResponse });
        await this.storage.saveMessage(this.currentChatId, 'assistant', fullResponse);
        this.renderSidebar();
        this.updateProgressUI();

        // Auto-title after first exchange
        if (messages.length === 2 && this.currentChatId) {
          fetch(`/api/conversations/${this.currentChatId}/generate-title`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.storage.getToken()}` },
          })
          .then(r => r.json())
          .then(({ title }) => {
            const el = this.dom.sidebarChats.querySelector(
              `[data-conv-id="${this.currentChatId}"] .chat-item-title`
            );
            if (el && title) el.textContent = title;
          })
          .catch(() => {});
        }

        if (messages.length % 8 === 0) {
          this.memory.learn(messages).catch(console.warn);
        }
      }
    } catch (err) {
      this.finalizeStreamingBubble();
      this.hideTyping();
      this.handleAIError(err);
    } finally {
      this.isProcessing = false;
      this.abortController = null;
      this.updateSendBtn();
      if (stopBtn) { stopBtn.style.display = 'none'; sendBtn.style.display = ''; }
      this.scrollBottom();
    }
  }

  handleAIError(err) {
    if (err.name === 'AbortError') return;
    if (err.message === 'NO_TOKEN') {
      this.appendBubble('anita', 'Сессия истекла. Войди снова по своей ссылке.');
      this.storage.clearToken();
      return;
    }
    if (err.message === 'DAILY_LIMIT') {
      this.appendBubble('anita', 'На сегодня лимит сообщений исчерпан. Очень жду тебя завтра 🌙');
      return;
    }
    this.appendBubble('anita', 'Что-то пошло не так. Попробуй ещё раз.');
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.finalizeStreamingBubble();
      this.isProcessing = false;
      this.updateSendBtn();
      const stopBtn = this.$('#stop-btn');
      if (stopBtn) stopBtn.style.display = 'none';
      this.dom.sendBtn.style.display = '';
    }
  }

  async streamWithRetry(messages, convId, onToken, onComplete, signal, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.ai.streamChat(messages, convId, onToken, onComplete, signal);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (err.message === 'DAILY_LIMIT') throw err;
        if (err.message === 'NO_TOKEN') throw err;
        if (attempt === maxRetries) throw err;

        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 300;
        console.warn(`[AI] Attempt ${attempt + 1} failed, retry in ${Math.round(delay)}ms`);

        const streamEl = document.getElementById('streaming-content');
        if (streamEl) streamEl.innerHTML = `<em style="opacity:0.5">Переподключение...</em>`;

        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  startStreamingBubble() {
    this.hideTyping();
    const div = document.createElement('div');
    div.className = 'message anita';
    div.id = 'streaming-bubble';
    div.innerHTML = `<div class="message-content" id="streaming-content"></div>
                     <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    this.dom.chatArea.appendChild(div);
    this.streamBuffer = '';
    return div;
  }

  appendStreamToken(token) {
    this.streamBuffer += token;
    const el = document.getElementById('streaming-content');
    if (el) {
      el.innerHTML = this.esc(this.streamBuffer).replace(/\n/g, '<br>');
      this.scrollBottom();
    }
  }

  finalizeStreamingBubble() {
    const el = document.getElementById('streaming-bubble');
    if (el) el.removeAttribute('id');
    const content = this.streamBuffer;
    this.streamBuffer = '';
    return content;
  }

  hideTyping() { this.removeTyping(); }

  // ══════════════════════════════════════════
  // UI HELPERS
  // ══════════════════════════════════════════
  appendBubble(role, content, isError = false) {
    const bubble = document.createElement('div');
    bubble.className = `message ${role} ${isError ? 'error' : ''}`;
    
    // Markdown-подобная обработка (переносы строк)
    const formatted = this.esc(content).replace(/\n/g, '<br>');
    
    bubble.innerHTML = `
      <div class="message-content">${formatted}</div>
      <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    
    this.dom.chatArea.appendChild(bubble);
    this.scrollBottom();
  }

  showTyping() {
    const t = document.createElement('div');
    t.id = 'typing-indicator';
    t.className = 'message anita typing';
    t.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    this.dom.chatArea.appendChild(t);
    this.scrollBottom();
  }

  removeTyping() {
    const t = this.$('#typing-indicator');
    if (t) t.remove();
  }

  renderSidebar() {
    const chats = this.storage.getChatsCache();
    this.dom.sidebarChats.innerHTML = '<div class="sidebar-section-title">Разговоры</div>';

    if (chats.length === 0) {
      this.dom.sidebarChats.innerHTML += '<div style="padding:20px; color:var(--text-muted); font-size:13px; text-align:center;">Пока нет истории разговоров</div>';
      return;
    }

    chats.forEach(chat => {
      const el = document.createElement('div');
      el.className = `chat-item ${this.currentChatId === chat.id ? 'active' : ''}`;
      el.innerHTML = `
        <div class="chat-item-title">${this.esc(chat.title || 'Новый разговор')}</div>
        <div class="chat-item-meta">${this.formatDate(chat.updated_at)}</div>
        <button class="chat-item-del" aria-label="Удалить">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.chat-item-del')) {
          e.stopPropagation();
          if (confirm('Удалить этот разговор?')) this.deleteChat(chat.id);
        } else {
          this.loadChat(chat.id);
        }
      });
      this.dom.sidebarChats.appendChild(el);
    });
  }

  updateProfile() {
    const p = this.storage.getProfile();
    if (this.dom.profileName) this.dom.profileName.textContent = p.name || 'Гость';

    // Hide "Войти или Зарегистрироваться" link for logged-in registered users
    if (this.dom.sidebarAuthLinks) {
      this.dom.sidebarAuthLinks.style.display = p.name ? 'none' : '';
    }

    if (this.dom.profileSessions) {
      this.dom.profileSessions.textContent = `${p.sessionsCount || 0} сессий`;
      this.dom.profileSessions.style.display = (p.name || p.sessionsCount > 0) ? 'block' : 'none';
    }

    if (this.dom.userNameInput) this.dom.userNameInput.value = p.name || '';
    if (this.dom.showProgressToggle) this.dom.showProgressToggle.checked = p.showProgress !== false;
  }

  openSettings()      { this.dom.settingsModal.classList.add('visible'); }
  closeSettings()     { this.dom.settingsModal.classList.remove('visible'); }
  saveSettings()      {
    const p = this.storage.getProfile();
    p.name = this.dom.userNameInput.value.trim();
    p.showProgress = this.dom.showProgressToggle.checked;
    this.storage.saveProfile(p);
    this.updateProfile();
    this.updateProgressUI();
    this.closeSettings();
  }

  toggleSidebar(open) {
    this.dom.sidebar.classList.toggle('open', open);
    this.dom.sidebarOverlay.classList.toggle('visible', open);
  }

  onInputChange() {
    this.autoResize();
    this.updateSendBtn();
  }

  autoResize() {
    const input = this.dom.msgInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  updateSendBtn() {
    this.dom.sendBtn.disabled = !this.dom.msgInput.value.trim() || this.isProcessing;
  }

  scrollBottom() {
    setTimeout(() => {
      this.dom.chatArea.scrollTo({ top: this.dom.chatArea.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  formatDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Сегодня';
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
}

// ── Запуск ──
const app = new AnitaApp();
document.addEventListener('DOMContentLoaded', () => app.init());
