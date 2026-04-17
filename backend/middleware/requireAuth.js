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
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role } or { adminId, role }

    if (decoded.role === 'user') {
      // Check if user exists and is not blocked
      const result = await db.query('SELECT is_blocked FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }
      if (result.rows[0].is_blocked) {
        return res.status(403).json({ error: 'Доступ заблокирован' });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }
    next();
  });
};

module.exports = { requireAuth, requireAdmin };
