const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('../db');

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Ваш IP заблокирован. Строгий лимит превышен.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Попробуй позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkBlacklistAndLimit = async (req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const authHeader = req.headers.authorization;
  let decodedUser = null;
  let isAdmin = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      decodedUser = jwt.verify(token, process.env.JWT_SECRET);
      if (decodedUser.role === 'admin') {
        isAdmin = true;
      }
    } catch (e) {
      // invalid token, ignore
    }
  }

  // Admin JWT bypasses everything
  if (isAdmin) {
    return next();
  }

  try {
    const result = await db.query('SELECT id FROM ip_blacklist WHERE ip = $1', [ip]);
    const isBlacklisted = result.rows.length > 0;

    if (isBlacklisted) {
      // 1. IP Blacklisted, but DO we have a valid NON-ADMIN JWT?
      if (decodedUser) {
        // Valid user token bypasses the strict block, maybe just apply standard limit or bypass?
        // Proposal says: "НЕТ -> JWT валидный? -> ДА -> Полный доступ"
        // Meaning user JWT bypasses rate limit too.
        return next();
      } else {
        // 2. Blacklisted and NO valid JWT -> Strict rate limit
        return strictLimiter(req, res, next);
      }
    } else {
      // 3. Not blacklisted and NO valid JWT -> Standard limit
      if (decodedUser) {
        // Valid JWT -> full access 
        return next();
      } else {
        return defaultLimiter(req, res, next);
      }
    }
  } catch (error) {
    console.error('Blacklist check error:', error);
    next(error);
  }
};

module.exports = checkBlacklistAndLimit;
