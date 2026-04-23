const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('anita_admin_jwt');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

async function apiCall(method, url, body = null) {
  const opts = { method, headers: getHeaders() };
  if (body) Object.assign(opts, { body: JSON.stringify(body) });
  
  const res = await fetch(`${API_BASE}${url}`, opts);
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Not authorized');
  }
  return res.json();
}

const ui = {
  loginScreen: document.getElementById('login-screen'),
  dashboardScreen: document.getElementById('dashboard-screen'),
  tabsNav: document.getElementById('admin-tabs'),
  tabContents: document.querySelectorAll('.tab-content'),
  invitesTable: document.querySelector('#invites-table tbody'),
  usersTable: document.querySelector('#users-table tbody'),
  geoTable: document.querySelector('#geo-table tbody'),
  logsTable: document.querySelector('#logs-table tbody'),
  blacklistTable: document.querySelector('#blacklist-table tbody'),
  inviteModal: document.getElementById('invite-modal'),
  userDetailsModal: document.getElementById('user-details-modal'),
};

function timeAgo(dateString) {
  if (!dateString) return '—';
  const diff = (new Date() - new Date(dateString)) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return Math.floor(diff / 60) + ' мин. назад';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч. назад';
  return Math.floor(diff / 86400) + ' дн. назад';
}

let usersData = [];
let currentUserId = null;

// --- AUTH ---
function checkAuth() {
  if (localStorage.getItem('anita_admin_jwt')) {
    ui.loginScreen.style.display = 'none';
    ui.dashboardScreen.style.display = 'block';
    loadDashboard();
  } else {
    ui.loginScreen.style.display = 'flex';
    ui.dashboardScreen.style.display = 'none';
  }
}
function logout() { localStorage.removeItem('anita_admin_jwt'); checkAuth(); }
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('login-btn').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('anita_admin_jwt', data.token);
    checkAuth();
  } catch (err) {
    document.getElementById('login-error').textContent = err.message;
  }
});

// --- TABS ---
ui.tabsNav.addEventListener('click', e => {
  if (e.target.classList.contains('nav-tab')) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    ui.tabContents.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.tab).classList.add('active');
    
    // Lazy load tab data
    const tId = e.target.dataset.tab;
    if (tId === 'tab-analytics') loadAnalytics();
    if (tId === 'tab-geo') loadGeo();
    if (tId === 'tab-security') loadBlacklist();
    if (tId === 'tab-logs') loadLogs();
    if (tId === 'tab-evolution') loadEvolution();
  }
});

// --- DATA LOADERS ---
async function loadDashboard() {
  try {
    const stats = await apiCall('GET', '/admin/stats');
    document.getElementById('stat-online').textContent = stats.onlineNow;
    document.getElementById('stat-total').textContent = stats.totalUsers;
    document.getElementById('stat-avg').textContent = stats.avgSessionMinutes;
    document.getElementById('stat-hours').textContent = stats.totalHours;
    loadInvites();
    loadUsers();
    // Token stats (non-blocking)
    apiCall('GET', '/admin/token-stats').then(rows => {
      if (rows?.length) {
        const today = rows[0];
        document.getElementById('stat-tokens').textContent =
          Number(today.total_all || 0).toLocaleString();
      }
    }).catch(() => {});
  } catch (e) { console.error(e); }
}

async function loadInvites() {
  const invites = await apiCall('GET', '/admin/invites');
  ui.invitesTable.innerHTML = '';
  invites.forEach(inv => {
    const tr = document.createElement('tr');
    const link = `${window.location.origin}/?invite=${inv.token}`;
    tr.innerHTML = `
      <td>${inv.label || '—'}</td>
      <td><input type="text" value="${link}" readonly style="background:transparent; color:#5ba8e0; border:none; outline:none; width:150px;"></td>
      <td>${inv.uses_count} / ${inv.max_uses}</td>
      <td>${inv.is_active ? '✅' : '❌'}</td>
      <td>
        <button onclick="window.toggleInvite('${inv.id}')" class="secondary">${inv.is_active ? 'Деактив.' : 'Актив.'}</button>
        <button onclick="window.deleteInvite('${inv.id}')" style="background:#ff6b6b">Удалить</button>
      </td>
    `;
    ui.invitesTable.appendChild(tr);
  });
}

function renderUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  ui.usersTable.innerHTML = '';
  usersData.filter(u => 
    (u.nickname && u.nickname.toLowerCase().includes(q)) || 
    (u.inviteLabel && u.inviteLabel.toLowerCase().includes(q)) ||
    (u.ip && u.ip.includes(q))
  ).forEach(u => {
    const tr = document.createElement('tr');
    const flag = u.country_code ? `<img src="https://flagcdn.com/24x18/${u.country_code.toLowerCase()}.png" alt="${u.country}" style="vertical-align:middle;margin-right:5px">` : '🏳️';
    tr.innerHTML = `
      <td>${u.nickname || '—'}</td>
      <td>${flag} ${u.country || 'Unknown'}</td>
      <td>${u.device_type} / ${u.browser}</td>
      <td>${u.inviteLabel || '—'}</td>
      <td>${new Date(u.firstSeen).toLocaleDateString()}</td>
      <td title="${new Date(u.lastSeen).toLocaleString()}">${timeAgo(u.lastSeen)}</td>
      <td>${u.totalSessions}</td>
      <td>${parseFloat(u.totalHours).toFixed(1)}</td>
      <td>${u.isOnline ? '<span class="online-dot">● Онлайн</span>' : '<span class="offline-dot">● Оффлайн</span>'}</td>
      <td>
        <button onclick="window.openUserModal('${u.id}')" class="secondary">Детали</button>
      </td>
    `;
    ui.usersTable.appendChild(tr);
  });
}

// ─── Живой поиск по нику (с debounce) ───────────────────────────────────────
let _searchTimeout = null;
let _allUsersCache = []; // кэш полного списка

async function loadUsers() {
  usersData = await apiCall('GET', '/admin/users');
  _allUsersCache = [...usersData];
  renderUsers();
}

document.getElementById('user-search').addEventListener('input', async e => {
  const q = e.target.value.trim();
  clearTimeout(_searchTimeout);

  if (q.length === 0) {
    usersData = [..._allUsersCache];
    renderUsers();
    return;
  }
  if (q.length < 2) return;

  _searchTimeout = setTimeout(async () => {
    try {
      usersData = await apiCall('GET', `/admin/users/search?q=${encodeURIComponent(q)}`);
      renderUsers();
    } catch (err) {
      console.error('[Search]', err);
    }
  }, 300);
});

// --- TABS DATA FETCH ---
async function loadAnalytics() {
  const hourly = await apiCall('GET', '/admin/analytics/hourly');
  const ret = await apiCall('GET', '/admin/analytics/retention');
  const invites = await apiCall('GET', '/admin/analytics/invites');
  
  if(ret.total > 0) {
    const pсt = Math.round((ret.returned_day1 / ret.total) * 100);
    document.getElementById('retention-info').innerHTML = `Вернулись минимум 2 раза: <strong>${pсt}%</strong> (${ret.returned_day1} из ${ret.total})`;
  } else {
    document.getElementById('retention-info').innerHTML = `Мало данных для расчета Retention`;
  }

  const hc = document.getElementById('hourly-heatmap');
  hc.innerHTML = '';
  const maxSess = Math.max(...hourly.map(h => parseInt(h.sessions_count)), 1);
  hourly.forEach(h => {
    const hBar = document.createElement('div');
    hBar.className = 'heatmap-bar';
    const heightPct = (parseInt(h.sessions_count) / maxSess) * 100;
    hBar.style.height = `${Math.max(heightPct, 5)}%`;
    hBar.title = `${parseInt(h.hour)}:00 - Сессий: ${h.sessions_count}`;
    hBar.innerHTML = `<span>${parseInt(h.hour)}:00</span>`;
    hc.appendChild(hBar);
  });

  const tb = document.querySelector('#analytics-invites-table tbody');
  tb.innerHTML = '';
  invites.forEach(i => {
    tb.innerHTML += `<tr><td>${i.label || '—'}</td><td>${i.token.substring(0,8)}...</td><td>${i.total_users}</td><td>${i.avg_sessions_per_user || 0}</td><td>${i.avg_messages_per_user || 0}</td></tr>`;
  });
}

async function loadGeo() {
  const geo = await apiCall('GET', '/admin/geo');
  ui.geoTable.innerHTML = '';
  geo.forEach(g => {
    const flag = g.country_code ? `<img src="https://flagcdn.com/24x18/${g.country_code.toLowerCase()}.png" alt="${g.country}" style="vertical-align:middle;margin-right:5px">` : '🏳️';
    ui.geoTable.innerHTML += `<tr><td>${flag} ${g.country}</td><td>${g.count}</td><td class="online-dot">${g.online > 0 ? g.online : ''}</td></tr>`;
  });
}

async function loadBlacklist() {
  const list = await apiCall('GET', '/admin/blacklist');
  ui.blacklistTable.innerHTML = '';
  list.forEach(i => {
    ui.blacklistTable.innerHTML += `<tr><td>${i.ip}</td><td>${i.reason || '—'}</td><td>${i.admin || '—'}</td><td>${new Date(i.created_at).toLocaleDateString()}</td><td><button style="background:#ff6b6b" onclick="window.delBlacklist('${i.id}')">Удалить</button></td></tr>`;
  });
}

async function loadLogs() {
  const logs = await apiCall('GET', '/admin/logs');
  ui.logsTable.innerHTML = '';
  logs.forEach(l => {
    ui.logsTable.innerHTML += `<tr><td>${new Date(l.created_at).toLocaleString()}</td><td>${l.admin}</td><td>${l.action}</td><td>${l.target_type} #${l.target_id}</td><td><pre style="margin:0;font-size:11px;">${JSON.stringify(l.details)}</pre></td></tr>`;
  });
}

// --- MODALS & ACTIONS ---
document.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', e => {
  e.target.closest('.modal').classList.remove('open');
}));

document.getElementById('create-invite-btn').addEventListener('click', () => {
  document.getElementById('new-invite-link-container').style.display = 'none';
  ui.inviteModal.classList.add('open');
});

document.getElementById('save-invite-btn').addEventListener('click', async () => {
  const label = document.getElementById('invite-label').value;
  const maxUses = document.getElementById('invite-max').value;
  const exp = document.getElementById('invite-exp').value;
  const res = await apiCall('POST', '/admin/invites', { label, maxUses: parseInt(maxUses), expiresAt: exp || null });
  document.getElementById('new-invite-link').value = `${window.location.origin}/?invite=${res.token}`;
  document.getElementById('new-invite-link-container').style.display = 'block';
  loadInvites();
});
document.getElementById('copy-link-btn').addEventListener('click', () => {
  const input = document.getElementById('new-invite-link');
  input.select(); document.execCommand('copy'); alert('Скопировано');
});

window.toggleInvite = async (id) => { await apiCall('PATCH', `/admin/invites/${id}/toggle`); loadInvites(); };
window.deleteInvite = async (id) => { if(confirm('Удалить?')) { await apiCall('DELETE', `/admin/invites/${id}`); loadInvites(); } };

// ─── Блокировка / разблокировка ─────────────────────────────────────────────
window.toggleBlockUser = async (id, isBlocked) => {
  const action = isBlocked ? 'разблокировать' : 'заблокировать';
  if (!confirm(`Вы уверены, что хотите ${action} этого пользователя?`)) return;
  try {
    const res = await apiCall('PATCH', `/admin/users/${id}/block`);
    alert(res.is_blocked ? '🔒 Заблокирован' : '✅ Разблокирован');
    loadUsers();
  } catch (err) { alert('Ошибка: ' + err.message); }
};

// ─── Полное удаление ─────────────────────────────────────────────────────────
window.deleteUser = async (id, nickname) => {
  if (!confirm(`⚠️ Удалить "${nickname || id}" НАВСЕГДА?\nДействие необратимо.`)) return;
  if (!confirm('Подтвержите ещё раз. Все данные будут удалены.')) return;
  try {
    await apiCall('DELETE', `/admin/users/${id}`);
    alert('✅ Пользователь удалён');
    ui.userDetailsModal.classList.remove('open');
    loadUsers();
  } catch (err) { alert('Ошибка: ' + err.message); }
};

// ─── Обновлённый openUserModal ────────────────────────────────────────────────
window.openUserModal = async (id) => {
  currentUserId = id;
  const user = usersData.find(u => u.id === id || u.id === parseInt(id));
  if (!user) return;

  document.getElementById('ud-id').textContent      = `#${user.id}`;
  document.getElementById('ud-ip').textContent      = user.ip || '—';
  document.getElementById('ud-device').textContent  = user.device_type || '—';
  document.getElementById('ud-browser').textContent = user.browser || '—';
  document.getElementById('ud-country').textContent = user.country || '—';
  document.getElementById('ud-note').value          = user.admin_note || '';

  // Динамическая кнопка блокировки
  const blockBtn = document.getElementById('ud-block-btn');
  if (blockBtn) {
    blockBtn.textContent       = user.is_blocked ? '✅ Разблокировать' : '🔒 Заблокировать';
    blockBtn.style.background  = user.is_blocked ? '#34c759' : '#ff9500';
    blockBtn.onclick = () => toggleBlockUser(id, user.is_blocked);
  }

  const deleteBtn = document.getElementById('ud-delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = () => deleteUser(id, user.nickname);
  }

  const sess = await apiCall('GET', `/admin/users/${id}/sessions`);
  const sl = document.getElementById('ud-sessions-list');
  sl.innerHTML = sess.length
    ? sess.map(s => `<li>
        ${new Date(s.started_at).toLocaleString()} —
        ${s.duration_seconds ? Math.round(s.duration_seconds / 60) + ' мин' : 'активна'}
        [${s.messages_count} сообщ.]
        ${s.is_active ? '<span style="color:#34c759">● онлайн</span>' : ''}
      </li>`).join('')
    : '<li style="color:var(--text-muted)">Нет сессий</li>';

  ui.userDetailsModal.classList.add('open');
};

document.getElementById('ud-save-note-btn').addEventListener('click', async () => {
  if(!currentUserId) return;
  await apiCall('PATCH', `/admin/users/${currentUserId}/note`, { note: document.getElementById('ud-note').value });
  alert('Сохранено');
  loadUsers();
});

document.getElementById('ud-ban-ip').addEventListener('click', async (e) => {
  e.preventDefault();
  const ip = document.getElementById('ud-ip').textContent;
  if(ip && ip !== '—' && confirm(`Заблокировать IP ${ip}?`)) {
    await apiCall('POST', '/admin/blacklist', { ip, reason: 'Manual block from user details' });
    alert('IP заблокирован');
    loadBlacklist();
  }
});

document.getElementById('ud-temp-ban').addEventListener('click', async () => {
  if (!currentUserId) return;
  const reason = prompt('Причина временного бана:');
  if (reason === null) return;
  await apiCall('POST', `/admin/users/${currentUserId}/temp-ban`, { reason });
  alert('Пользователь временно заблокирован');
  loadUsers();
});

document.getElementById('ud-unban').addEventListener('click', async () => {
  if (!currentUserId) return;
  const label = prompt('Подпись для нового инвайта (необязательно):') || 'Повторный доступ';
  const res = await apiCall('POST', `/admin/users/${currentUserId}/unban`, { label });
  if (res.newLink) {
    prompt('Новая инвайт-ссылка (скопируй):', res.newLink);
  }
  alert('Пользователь разбанен, новый инвайт создан');
  loadUsers();
});

// EXPORT
document.getElementById('export-users-btn').addEventListener('click', async () => {
  try {
    const { downloadToken } = await apiCall('POST', '/admin/generate-download-token');
    window.open(`${API_BASE}/admin/users/export?dt=${downloadToken}`, '_blank');
  } catch (e) {
    alert('Ошибка при получении токена для экспорта');
  }
});

// BLACKLIST ACTIONS
document.getElementById('add-blacklist-btn').addEventListener('click', async () => {
  const ip = document.getElementById('blacklist-ip').value;
  const reason = document.getElementById('blacklist-reason').value;
  await apiCall('POST', '/admin/blacklist', { ip, reason });
  document.getElementById('blacklist-ip').value = '';
  document.getElementById('blacklist-reason').value = '';
  loadBlacklist();
});
window.delBlacklist = async (id) => { if(confirm('Удалить?')) { await apiCall('DELETE', `/admin/blacklist/${id}`); loadBlacklist(); } };

// ── EVOLUTION TAB ──────────────────────────────────────────────
async function loadEvolution() {
  // Technique stats
  try {
    const stats = await apiCall('GET', '/admin/evolution/technique-stats');
    const tb = document.querySelector('#technique-stats-table tbody');
    tb.innerHTML = '';
    (stats || []).forEach(t => {
      tb.innerHTML += `<tr>
        <td>${t.technique_name}</td>
        <td>${t.total_uses}</td>
        <td style="color:#34c759">${t.positive_outcomes}</td>
        <td style="color:#ff6b6b">${t.negative_outcomes}</td>
        <td>${t.success_rate_pct ?? '—'}%</td>
        <td>${t.avg_turn_used ? parseFloat(t.avg_turn_used).toFixed(1) : '—'}</td>
      </tr>`;
    });
    if (!stats?.length) tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888">Нет данных</td></tr>';
  } catch (e) { console.warn('technique-stats', e); }

  // Suggestions
  try {
    const suggestions = await apiCall('GET', '/admin/evolution/suggestions');
    const container = document.getElementById('suggestions-list');
    container.innerHTML = '';
    (suggestions || []).forEach(s => {
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--bg-secondary,#1a2740);border-radius:8px;padding:16px;border:1px solid #2a3a5a;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <strong style="color:#5ba8e0">${s.suggestion_type || ''}</strong>
          <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#2a3a5a">${s.status}</span>
        </div>
        <p style="margin:4px 0;font-size:13px;color:#aaa"><strong>Обоснование:</strong> ${s.reasoning}</p>
        <p style="margin:4px 0;font-size:13px;color:#aaa"><strong>Ожидаемый эффект:</strong> ${s.expected_benefit}</p>
        ${s.potential_risks ? `<p style="margin:4px 0;font-size:12px;color:#888"><strong>Риски:</strong> ${s.potential_risks}</p>` : ''}
        ${s.status === 'pending' ? `<div style="margin-top:10px;display:flex;gap:8px;">
          <button onclick="updateSuggestion('${s.id}','approved')" style="background:#34c759">✅ Применить</button>
          <button onclick="updateSuggestion('${s.id}','rejected')" style="background:#ff6b6b">❌ Отклонить</button>
          <button onclick="updateSuggestion('${s.id}','testing')" style="background:#ff9500">🧪 Тестировать</button>
        </div>` : ''}
      `;
      container.appendChild(card);
    });
    if (!suggestions?.length) container.innerHTML = '<p style="color:#888;text-align:center">Нет предложений</p>';
  } catch (e) { console.warn('suggestions', e); }

  // Crisis events
  try {
    const crises = await apiCall('GET', '/admin/evolution/crisis-events');
    const tb = document.querySelector('#crisis-table tbody');
    tb.innerHTML = '';
    (crises || []).forEach(c => {
      const reviewed = c.reviewed_at;
      tb.innerHTML += `<tr>
        <td>${new Date(c.created_at).toLocaleString()}</td>
        <td>${c.nickname || c.user_id?.slice(0,8) || '—'}</td>
        <td style="max-width:300px;white-space:normal">${c.trigger_phrase || '—'}</td>
        <td>${reviewed ? '<span style="color:#34c759">Проверено</span>' : '<span style="color:#ff9500">Ожидает</span>'}</td>
        <td>${!reviewed ? `<button onclick="reviewCrisis('${c.id}')" class="secondary">Отметить</button>` : ''}</td>
      </tr>`;
    });
    if (!crises?.length) tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888">Нет событий</td></tr>';
  } catch (e) { console.warn('crisis-events', e); }
}

window.updateSuggestion = async (id, status) => {
  await apiCall('PATCH', `/admin/evolution/suggestions/${id}`, { status });
  loadEvolution();
};

window.reviewCrisis = async (id) => {
  await apiCall('PATCH', `/admin/evolution/crisis-events/${id}/review`);
  loadEvolution();
};

setInterval(() => {
  if (ui.dashboardScreen.style.display === 'block') loadDashboard();
}, 30000);

checkAuth();
