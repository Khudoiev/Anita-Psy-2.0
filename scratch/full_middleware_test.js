const jwt = require('jsonwebtoken');

// Mock db
const db = {
  query: async (sql, params) => {
    console.log('SQL:', sql, params);
    if (sql.includes('SELECT id FROM admins')) {
      return { rows: [{ id: 'admin-id' }] };
    }
    return { rows: [] };
  }
};

// Mock JWT secret
process.env.JWT_SECRET = 'test-secret';

// Load middleware
// We need to inject our mock db into the middleware
// Since it's using require('../db'), we might need to mock the module
// Or just monkey-patch it if we can.
const dbModule = require('./backend/db');
dbModule.query = db.query;

const { requireAuth, requireAdmin } = require('./backend/middleware/requireAuth');

async function runTest() {
  console.log('--- Testing requireAdmin success ---');
  const adminToken = jwt.sign({ adminId: 'admin-id', role: 'admin' }, process.env.JWT_SECRET);
  
  const req = {
    headers: { authorization: `Bearer ${adminToken}` },
    user: null // Will be set by requireAuth
  };
  const res = {
    status: (code) => {
      console.log('Res Status:', code);
      return { json: (obj) => console.log('Res JSON:', obj) };
    }
  };
  const next = (err) => console.log('Next called:', err || 'SUCCESS');

  await requireAdmin(req, res, next);
  
  console.log('--- Testing requireAdmin failure (no adminId) ---');
  const fakeToken = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET);
  const req2 = {
    headers: { authorization: `Bearer ${fakeToken}` },
    user: null
  };
  await requireAdmin(req2, res, next);
}

runTest().catch(console.error);
