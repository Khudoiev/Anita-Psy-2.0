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
let charts = { dau: null, tokens: null };

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
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  ui.tabContents.forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  if (tabId === 'tab-analytics') loadAnalytics();
  if (tabId === 'tab-geo') loadGeo();
  if (tabId === 'tab-security') loadBlacklist();
  if (tabId === 'tab-logs') loadLogs();
  if (tabId === 'tab-evolution') loadEvolution();
}

document.getElementById('stat-online').closest('.stat-card').addEventListener('click', () => switchTab('tab-main'));
document.getElementById('stat-total').closest('.stat-card').addEventListener('click', () => switchTab('tab-main'));
document.getElementById('stat-avg').closest('.stat-card').addEventListener('click', () => switchTab('tab-analytics'));
document.getElementById('stat-hours').closest('.stat-card').addEventListener('click', () => switchTab('tab-analytics'));
document.getElementById('stat-tokens').closest('.stat-card').addEventListener('click', () => switchTab('tab-analytics'));

ui.tabsNav.addEventListener('click', e => {
  if (e.target.classList.contains('nav-tab')) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    ui.tabContents.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    const tabId = e.target.dataset.tab;
    document.getElementById(tabId).classList.add('active');
    
    // Lazy load tab data
    if (tabId === 'tab-analytics') loadAnalytics();
    if (tabId === 'tab-geo') loadGeo();
    if (tabId === 'tab-security') loadBlacklist();
    if (tabId === 'tab-logs') loadLogs();
    if (tabId === 'tab-evolution') loadEvolution();
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
    const link = inv.invite_url || `/register?token=${inv.token}`;
    tr.innerHTML = `
      <td>${inv.label || '—'}</td>
      <td><input type="text" value="${link}" readonly style="background:transparent; border:none; outline:none; width:200px; color:var(--accent-primary)"></td>
      <td>${inv.uses_count} / ${inv.max_uses}</td>
      <td><span class="badge ${inv.is_active ? 'badge-online' : 'badge-offline'}">${inv.is_active ? 'Активен' : 'Отключен'}</span></td>
      <td>
        <button onclick="window.toggleInvite('${inv.id}')" class="secondary">${inv.is_active ? 'Деактив.' : 'Актив.'}</button>
        <button onclick="window.deleteInvite('${inv.id}')" style="background:rgba(239, 68, 68, 0.1); color:var(--danger)">Удалить</button>
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
    const flag = u.country_code ? `<img src="https://flagcdn.com/24x18/${u.country_code.toLowerCase()}.png" alt="${u.country}" style="vertical-align:middle;margin-right:5px; border-radius:2px">` : '🏳️';
    tr.innerHTML = `
      <td><strong>${u.nickname || '—'}</strong></td>
      <td>${flag} ${u.country || 'Unknown'}</td>
      <td style="font-size:0.8rem; color:var(--text-muted)">${u.device_type} / ${u.browser}</td>
      <td><span style="font-size:0.8rem">${u.inviteLabel || '—'}</span></td>
      <td style="font-size:0.8rem">${new Date(u.firstSeen).toLocaleDateString()}</td>
      <td style="font-size:0.8rem" title="${new Date(u.lastSeen).toLocaleString()}">${timeAgo(u.lastSeen)}</td>
      <td>${u.totalSessions}</td>
      <td>${parseFloat(u.totalHours).toFixed(1)}h</td>
      <td>
        <span class="badge ${u.is_blocked ? 'badge-blocked' : (u.isOnline ? 'badge-online' : 'badge-offline')}">
          ${u.is_blocked ? 'Забанен' : (u.isOnline ? '● Онлайн' : 'Оффлайн')}
        </span>
      </td>
      <td>
        <button onclick="window.openUserModal('${u.id}')" class="secondary">Детали</button>
      </td>
    `;
    ui.usersTable.appendChild(tr);
  });
}

// ─── Поиск по нику ───────────────────────────────────────
let _searchTimeout = null;
let _allUsersCache = [];

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
    } catch (err) { console.error('[Search]', err); }
  }, 300);
});

// --- ANALYTICS ---
async function loadAnalytics() {
  const hourly = await apiCall('GET', '/admin/analytics/hourly');
  const daily = await apiCall('GET', '/admin/analytics/daily');
  const ret = await apiCall('GET', '/admin/analytics/retention');
  const invites = await apiCall('GET', '/admin/analytics/invites');
  const tokens = await apiCall('GET', '/admin/token-stats');
  
  if(ret.total > 0) {
    const pct = Math.round((ret.returned_day1 / ret.total) * 100);
    document.getElementById('retention-info').innerHTML = `Вернулись минимум 2 раза: <strong style="color:var(--success)">${pct}%</strong> (${ret.returned_day1} из ${ret.total})`;
  } else {
    document.getElementById('retention-info').innerHTML = `Мало данных для расчета Retention`;
  }

  // Hourly Heatmap
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

  // Invites Analytics
  const tb = document.querySelector('#analytics-invites-table tbody');
  tb.innerHTML = '';
  invites.forEach(i => {
    tb.innerHTML += `<tr><td><strong>${i.label || '—'}</strong></td><td style="font-family:monospace; font-size:0.8rem">${i.token.substring(0,8)}...</td><td>${i.total_users}</td><td>${i.avg_sessions_per_user || 0}</td><td>${i.avg_messages_per_user || 0}</td></tr>`;
  });

  // Charts
  renderCharts(daily, tokens);
}

function renderCharts(daily, tokens) {
  // DAU Chart
  const dauCtx = document.getElementById('chart-dau').getContext('2d');
  if (charts.dau) charts.dau.destroy();
  const dailyRows = [...daily].reverse();
  charts.dau = new Chart(dauCtx, {
    type: 'line',
    data: {
      labels: dailyRows.map(r => new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
      datasets: [{
        label: 'DAU (Активные пользователи)',
        data: dailyRows.map(r => r.dau),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
    }
  });

  // Token Chart
  const tokensCtx = document.getElementById('chart-tokens').getContext('2d');
  if (charts.tokens) charts.tokens.destroy();
  const tokenRows = [...tokens].reverse();
  charts.tokens = new Chart(tokensCtx, {
    type: 'bar',
    data: {
      labels: tokenRows.map(r => new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
      datasets: [{
        label: 'Всего токенов',
        data: tokenRows.map(r => r.total_all),
        backgroundColor: '#8b5cf6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
    }
  });
}

async function loadGeo() {
  const geo = await apiCall('GET', '/admin/geo');
  ui.geoTable.innerHTML = '';
  geo.forEach(g => {
    const flag = g.country_code ? `<img src="https://flagcdn.com/24x18/${g.country_code.toLowerCase()}.png" alt="${g.country}" style="vertical-align:middle;margin-right:5px; border-radius:2px">` : '🏳️';
    ui.geoTable.innerHTML += `<tr><td><strong>${flag} ${g.country}</strong></td><td>${g.count}</td><td><span class="badge badge-online">${g.online > 0 ? g.online : '—'}</span></td></tr>`;
  });
}

async function loadBlacklist() {
  const list = await apiCall('GET', '/admin/blacklist');
  ui.blacklistTable.innerHTML = '';
  list.forEach(i => {
    ui.blacklistTable.innerHTML += `<tr><td><strong>${i.ip}</strong></td><td>${i.reason || '—'}</td><td>${i.admin || '—'}</td><td>${new Date(i.created_at).toLocaleDateString()}</td><td><button style="background:rgba(239, 68, 68, 0.1); color:var(--danger)" onclick="window.delBlacklist('${i.id}')">Удалить</button></td></tr>`;
  });
}

async function loadLogs() {
  const logs = await apiCall('GET', '/admin/logs');
  ui.logsTable.innerHTML = '';
  logs.forEach(l => {
    ui.logsTable.innerHTML += `<tr>
      <td><span style="font-size:0.8rem; color:var(--text-muted)">${new Date(l.created_at).toLocaleString()}</span></td>
      <td><strong>${l.admin}</strong></td>
      <td><span class="badge badge-online">${l.action}</span></td>
      <td><span style="font-size:0.8rem">${l.target_type} #${l.target_id.slice(0,8)}...</span></td>
      <td><pre style="margin:0;font-size:10px; color:var(--text-dim)">${JSON.stringify(l.details)}</pre></td>
    </tr>`;
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
  document.getElementById('new-invite-link').value = res.invite_url || `${window.location.origin}/register?token=${res.token}`;
  document.getElementById('new-invite-link-container').style.display = 'block';
  loadInvites();
});

document.getElementById('copy-link-btn').addEventListener('click', () => {
  const input = document.getElementById('new-invite-link');
  input.select(); document.execCommand('copy');
});

window.toggleInvite = async (id) => { await apiCall('PATCH', `/admin/invites/${id}/toggle`); loadInvites(); };
window.deleteInvite = async (id) => { if(confirm('Удалить?')) { await apiCall('DELETE', `/admin/invites/${id}`); loadInvites(); } };

window.toggleBlockUser = async (id, isBlocked) => {
  const action = isBlocked ? 'разблокировать' : 'заблокировать';
  if (!confirm(`Вы уверены, что хотите ${action} этого пользователя?`)) return;
  try {
    const res = await apiCall('PATCH', `/admin/users/${id}/block`);
    loadUsers();
  } catch (err) { alert('Ошибка: ' + err.message); }
};

window.deleteUser = async (id, nickname) => {
  if (!confirm(`⚠️ Удалить "${nickname || id}" НАВСЕГДА?\nДействие необратимо.`)) return;
  try {
    await apiCall('DELETE', `/admin/users/${id}`);
    ui.userDetailsModal.classList.remove('open');
    loadUsers();
  } catch (err) { alert('Ошибка: ' + err.message); }
};

window.openUserModal = async (id) => {
  currentUserId = id;
  const user = usersData.find(u => u.id === id || u.id === parseInt(id));
  if (!user) return;

  document.getElementById('ud-id').textContent      = user.id.slice(0,12) + '...';
  document.getElementById('ud-ip').textContent      = user.ip || '—';
  document.getElementById('ud-device').textContent  = user.device_type || '—';
  document.getElementById('ud-browser').textContent = user.browser || '—';
  document.getElementById('ud-country').textContent = user.country || '—';
  document.getElementById('ud-note').value          = user.admin_note || '';

  const blockBtn = document.getElementById('ud-block-btn');
  if (blockBtn) {
    blockBtn.textContent       = user.is_blocked ? '✅ Разблокировать' : '🔒 Заблокировать';
    blockBtn.style.background  = user.is_blocked ? 'var(--success)' : 'var(--warning)';
    blockBtn.onclick = () => toggleBlockUser(id, user.is_blocked);
  }

  const deleteBtn = document.getElementById('ud-delete-btn');
  if (deleteBtn) { deleteBtn.onclick = () => deleteUser(id, user.nickname); }

  const sess = await apiCall('GET', `/admin/users/${id}/sessions`);
  const sl = document.getElementById('ud-sessions-list');
  sl.innerHTML = sess.length
    ? sess.map(s => `<li>
        <span style="color:var(--text-muted)">${new Date(s.started_at).toLocaleString()}</span> —
        <strong>${s.duration_seconds ? Math.round(s.duration_seconds / 60) + ' мин' : 'активна'}</strong>
        [${s.messages_count} сообщ.]
        ${s.is_active ? '<span class="badge badge-online">online</span>' : ''}
      </li>`).join('')
    : '<li style="color:var(--text-muted)">Нет сессий</li>';

  ui.userDetailsModal.classList.add('open');
};

document.getElementById('ud-save-note-btn').addEventListener('click', async () => {
  if(!currentUserId) return;
  await apiCall('PATCH', `/admin/users/${currentUserId}/note`, { note: document.getElementById('ud-note').value });
  loadUsers();
});

document.getElementById('ud-ban-ip').addEventListener('click', async (e) => {
  e.preventDefault();
  const ip = document.getElementById('ud-ip').textContent;
  if(ip && ip !== '—' && confirm(`Заблокировать IP ${ip}?`)) {
    await apiCall('POST', '/admin/blacklist', { ip, reason: 'Manual block from user details' });
    loadBlacklist();
  }
});

// --- EVOLUTION ---
async function loadEvolution() {
  try {
    const stats = await apiCall('GET', '/admin/evolution/technique-stats');
    const tb = document.querySelector('#technique-stats-table tbody');
    tb.innerHTML = '';
    (stats || []).forEach(t => {
      tb.innerHTML += `<tr>
        <td><strong>${t.technique_name}</strong></td>
        <td>${t.total_uses}</td>
        <td style="color:var(--success)">${t.positive_outcomes}</td>
        <td style="color:var(--danger)">${t.negative_outcomes}</td>
        <td><strong style="color:var(--accent-primary)">${t.success_rate_pct ?? '—'}%</strong></td>
        <td>${t.avg_turn_used ? parseFloat(t.avg_turn_used).toFixed(1) : '—'}</td>
      </tr>`;
    });
  } catch (e) { console.warn(e); }

  try {
    const suggestions = await apiCall('GET', '/admin/evolution/suggestions');
    const container = document.getElementById('suggestions-list');
    container.innerHTML = '';
    (suggestions || []).forEach(s => {
      const card = document.createElement('div');
      card.className = 'panel';
      card.style.padding = '1.5rem';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">
          <h4 style="margin:0; color:var(--accent-primary)">${s.suggestion_type || 'Suggestion'}</h4>
          <span class="badge badge-online">${s.status}</span>
        </div>
        <p style="margin:0.5rem 0;font-size:0.9rem;"><strong>💡 Idea:</strong> ${s.proposed_text || s.reasoning}</p>
        <p style="margin:0.5rem 0;font-size:0.8rem;color:var(--text-dim)"><strong>🎯 Benefit:</strong> ${s.expected_benefit}</p>
        ${s.status === 'pending' ? `<div style="margin-top:1.5rem;display:flex;gap:0.75rem;">
          <button onclick="updateSuggestion('${s.id}','approved')" style="background:var(--success)">✅ Approve</button>
          <button onclick="updateSuggestion('${s.id}','rejected')" style="background:rgba(239, 68, 68, 0.1); color:var(--danger)">❌ Reject</button>
        </div>` : ''}
      `;
      container.appendChild(card);
    });
  } catch (e) { console.warn(e); }
  
  // Crisis events
  try {
    const crises = await apiCall('GET', '/admin/evolution/crisis-events');
    const tb = document.querySelector('#crisis-table tbody');
    tb.innerHTML = '';
    (crises || []).forEach(c => {
      tb.innerHTML += `<tr>
        <td>${new Date(c.created_at).toLocaleString()}</td>
        <td><strong>${c.nickname || '—'}</strong></td>
        <td style="color:var(--danger)">${c.trigger_phrase || '—'}</td>
        <td><span class="badge ${c.reviewed_at ? 'badge-online' : 'badge-blocked'}">${c.reviewed_at ? 'Reviewed' : 'Action Required'}</span></td>
        <td>${!c.reviewed_at ? `<button onclick="reviewCrisis('${c.id}')" class="secondary">Review</button>` : '—'}</td>
      </tr>`;
    });
  } catch (e) { console.warn(e); }
}

window.updateSuggestion = async (id, status) => { await apiCall('PATCH', `/admin/evolution/suggestions/${id}`, { status }); loadEvolution(); };
window.reviewCrisis = async (id) => { await apiCall('PATCH', `/admin/evolution/crisis-events/${id}/review`); loadEvolution(); };
window.delBlacklist = async (id) => { if(confirm('Удалить?')) { await apiCall('DELETE', `/admin/blacklist/${id}`); loadBlacklist(); } };

async function checkCrisis() {
  try {
    const crises = await apiCall('GET', '/admin/evolution/crisis-events');
    const pending = crises.filter(c => !c.reviewed_at).length;
    const badge = document.getElementById('crisis-badge');
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {}
}

setInterval(() => {
  if (ui.dashboardScreen.style.display === 'block') {
    loadDashboard();
    checkCrisis();
  }
}, 30000);

checkAuth();
checkCrisis();
