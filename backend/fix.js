const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query('UPDATE admins SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
  console.log('Fixed:', hash);
  process.exit(0);
}
fix();
