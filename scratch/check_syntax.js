const { requireAuth, requireAdmin } = require('./backend/middleware/requireAuth');
const db = require('./backend/db');

async function test() {
  console.log('Testing requireAuth/requireAdmin...');
  
  // Mock req, res, next
  const req = {
    headers: { authorization: 'Bearer some-token' },
    user: { role: 'admin', adminId: 'some-id' }
  };
  const res = {
    status: (code) => ({ json: (obj) => console.log(`Response ${code}:`, obj) })
  };
  const next = (err) => console.log('Next called:', err || 'success');

  // Test requireAdmin
  try {
    await requireAdmin(req, res, next);
  } catch (e) {
    console.error('Error in requireAdmin:', e);
  }
}

// Note: This script will fail because db.query is not mocked and no DB is running.
// But it helps check for syntax errors.
// test();
console.log('Syntax check passed');
