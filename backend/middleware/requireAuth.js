const jwt = require('jsonwebtoken');
const db = require('../db');

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  req.user = decoded; // { userId, role } or { adminId, role }

  if (decoded.role === 'user') {
    let result;
    try {
      result = await db.query(
        `SELECT u.is_blocked,
                EXISTS(
                  SELECT 1 FROM temp_bans tb
                  WHERE tb.user_id = u.id AND tb.unbanned_at IS NULL
                ) as is_temp_banned
         FROM users u WHERE u.id = $1`,
        [decoded.userId]
      );
    } catch (err) {
      return next(err);
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const userStatus = result.rows[0];

    if (userStatus.is_blocked) {
      return res.status(403).json({ error: 'Доступ заблокирован' });
    }

    if (userStatus.is_temp_banned) {
      return res.status(403).json({
        error: 'temp_banned',
        message: 'Доступ временно ограничен. Обратитесь к администратору.'
      });
    }
  }

  next();
};

const requireAdmin = (req, res, next) => {
  const adminIp = process.env.ADMIN_IP;
  // Получаем IP клиента (с учетом прокси)
  const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;

  if (adminIp && clientIp && clientIp.includes(adminIp)) {
    // Если IP совпадает, создаем виртуальную сессию админа
    req.user = { 
      role: 'admin', 
      adminId: '00000000-0000-0000-0000-000000000000', // Системный ID для логов
      username: 'IP_ADMIN'
    };
    return next();
  }

  requireAuth(req, res, async (err) => {
    if (err) return next(err);

    // 1. JWT должен иметь role === 'admin'
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }

    // 2. ФИКС: adminId должен реально существовать в таблице admins.
    //    Защищает от эскалации: user JWT с role:'admin' не проходит,
    //    т.к. userId не является записью в таблице admins.
    if (!req.user.adminId) {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }

    try {
      const result = await db.query(
        'SELECT id FROM admins WHERE id = $1',
        [req.user.adminId]
      );
      if (!result.rows.length) {
        return res.status(403).json({ error: 'Требуются права администратора' });
      }
      next();
    } catch (dbErr) {
      return next(dbErr);
    }
  });
};

module.exports = { requireAuth, requireAdmin };
