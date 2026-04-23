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
      // Check if user exists, is not blocked, invite still exists, and NO temp ban
      const result = await db.query(
        `SELECT u.is_blocked,
                u.invite_id,
                EXISTS(SELECT 1 FROM invites i WHERE i.id = u.invite_id) as invite_exists,
                EXISTS(
                  SELECT 1 FROM temp_bans tb 
                  WHERE tb.user_id = u.id AND tb.unbanned_at IS NULL
                ) as is_temp_banned
         FROM users u WHERE u.id = $1`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }

      const userStatus = result.rows[0];

      // 1. Permanent block
      if (userStatus.is_blocked) {
        return res.status(403).json({ error: 'Доступ заблокирован' });
      }

      // 2. Invite deleted (User is "thrown out")
      if (userStatus.invite_id && !userStatus.invite_exists) {
        return res.status(403).json({ 
          error: 'session_invalidated', 
          message: 'Сессия недействительна (приглашение отозвано).' 
        });
      }

      // 3. Temporary ban
      if (userStatus.is_temp_banned) {
        return res.status(403).json({
          error: 'temp_banned',
          message: 'Доступ временно ограничен. Обратитесь к администратору.'
        });
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
