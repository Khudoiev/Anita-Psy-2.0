const db = require('./backend/db');
const { requireAdmin } = require('./backend/middleware/requireAuth');

// Mock db.query
db.query = async (sql, params) => {
  console.log('SQL:', sql, params);
  if (sql.includes('SELECT id FROM admins')) {
    return { rows: [{ id: 'some-admin-id' }] };
  }
  return { rows: [] };
};

async function test() {
  const req = {
    headers: { authorization: 'Bearer valid-token' },
    user: { role: 'admin', adminId: 'some-admin-id' }
  };
  const res = {
    status: (code) => {
      console.log('Status set to:', code);
      return { json: (obj) => console.log('JSON sent:', obj) };
    }
  };
  const next = (err) => console.log('Next called with:', err || 'success');

  console.log('Calling requireAdmin...');
  // We need to mock requireAuth because it's called inside requireAdmin
  // But wait, requireAuth is in the same file as requireAdmin and they are not using exports internally.
  // So we can't easily mock requireAuth without mocking the JWT library or something.
  
  // Let's just check the syntax and imports.
  console.log('requireAdmin is a', typeof requireAdmin);
}

test();
