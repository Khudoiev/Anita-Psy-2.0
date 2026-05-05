const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const SECRET = process.env.E2E_SECRET || '';

async function e2e(path, options = {}) {
  const res = await fetch(`${BASE}/api/e2e${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-E2E-Secret': SECRET,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`E2E API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function cleanE2EUsers() {
  await e2e('/cleanup', { method: 'POST' });
}

// Cleanup делает всё за один вызов — invites чистятся там же
async function cleanE2EInvites() {}

async function createE2EInvite(label = 'e2e_default') {
  const data = await e2e('/invite', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
  return data.token;
}

async function userExists(username) {
  const data = await e2e(`/user/${encodeURIComponent(username)}/exists`);
  return data.exists;
}

async function getUserProfile(username) {
  const data = await e2e(`/user/${encodeURIComponent(username)}/profile`);
  return data.profile;
}

// no-op — нет пула соединений к БД
async function closePool() {}

module.exports = {
  cleanE2EUsers,
  cleanE2EInvites,
  createE2EInvite,
  userExists,
  getUserProfile,
  closePool,
};
