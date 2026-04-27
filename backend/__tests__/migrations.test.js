/**
 * backend/__tests__/migrations.test.js
 * Тесты: базовая миграция применяется на чистую БД и создаёт все нужные таблицы.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });
require('dotenv').config();

const db = require('../db');

// Список таблиц которые должны существовать после baseline миграции
const EXPECTED_TABLES = [
  'admins',
  'admin_logs',
  'invites',
  'users',
  'user_chats',
  'chat_messages',
  'conversations',
  'messages',
  'crisis_events',
  'ip_blacklist',
  'message_quota',
  'password_reset_requests',
  'sessions',
  'technique_outcomes',
  'token_usage',
  'user_consent',
  'user_memory',
  'prompt_suggestions',
];

const EXPECTED_INDEXES = [
  'idx_conv_guest',
  'idx_conv_user',
  'idx_memory_user',
  'idx_messages_conv',
  'idx_messages_expiry',
  'idx_outcomes_technique',
  'idx_quota_user_date',
  'idx_sessions_heartbeat',
];

describe('Baseline миграция — схема БД', () => {
  test('все ожидаемые таблицы существуют', async () => {
    const res = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);
    const existingTables = res.rows.map(r => r.table_name);

    for (const table of EXPECTED_TABLES) {
      expect(existingTables).toContain(table);
    }
  });

  test('таблица sessions содержит колонку last_heartbeat', async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sessions'
    `);
    const columns = res.rows.map(r => r.column_name);
    expect(columns).toContain('last_heartbeat');
    expect(columns).toContain('is_active');
  });

  test('таблица conversations содержит все нужные колонки', async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
    `);
    const columns = res.rows.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('user_id');
    expect(columns).toContain('guest_token');
    expect(columns).toContain('messages_count');
    expect(columns).toContain('is_archived');
  });

  test('таблица users содержит все нужные колонки (включая ip и зарегистрированные поля)', async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
    `);
    const columns = res.rows.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('ip');
    expect(columns).toContain('username');
    expect(columns).toContain('registered_at');
    expect(columns).toContain('password_hash');
  });

  test('все ожидаемые индексы существуют', async () => {
    const res = await db.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    const existingIndexes = res.rows.map(r => r.indexname);

    for (const idx of EXPECTED_INDEXES) {
      expect(existingIndexes).toContain(idx);
    }
  });

  test('материализованное представление technique_stats существует', async () => {
    const res = await db.query(`
      SELECT matviewname
      FROM pg_matviews
      WHERE schemaname = 'public'
    `);
    const views = res.rows.map(r => r.matviewname);
    expect(views).toContain('technique_stats');
  });

  test('расширение pgcrypto активно', async () => {
    const res = await db.query(`
      SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'
    `);
    expect(res.rows.length).toBe(1);
  });

  test('таблица pgmigrations содержит запись о baseline', async () => {
    const res = await db.query(
      `SELECT name FROM pgmigrations WHERE name LIKE '%baseline%'`
    );
    expect(res.rows.length).toBeGreaterThan(0);
  });
});
