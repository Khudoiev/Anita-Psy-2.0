const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('../db');

const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Попробуй позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkBlacklistAndLimit = async (req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim().replace(/^::ffff:/, '');
  const authHeader = req.headers.authorization;
  let decodedUser = null;
  let isAdmin = false;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      decodedUser = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      if (decodedUser.role === 'admin') isAdmin = true;
    } catch {}
  }

  if (isAdmin) return next();

  try {
    const result = await db.query('SELECT id FROM ip_blacklist WHERE ip = $1', [ip]);
    if (result.rows.length > 0) {
      // ФИКС: JWT не спасает заблокированный IP
      return res.status(403).json({ error: 'Доступ заблокирован.', code: 'IP_BLACKLISTED' });
    }
    if (!decodedUser) return defaultLimiter(req, res, next);
    return next();
  } catch (error) {
    console.error('Blacklist check error:', error);
    next();
  }
};

module.exports = checkBlacklistAndLimit;
