const path = require('path');
// Загружаем .env из корня проекта (на случай запуска node server.js из папки backend/)
require('dotenv').config({ path: path.join(__dirname, '../.env.local') }); // для локальной разработки
require('dotenv').config();                                                  // для Docker (env передаётся через compose)

const app    = require('./app');
const logger = require('./services/logger');

try { require('./cron'); } catch (e) { logger.warn({ err: e.message }, '[Cron] Not loaded'); }

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info({ port: PORT }, 'Backend server started'));
