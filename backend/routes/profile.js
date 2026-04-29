const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { getProfile } = require('../services/memoryService');

// GET /api/profile
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  try {
    const profile = await getProfile(req.user.userId);
    res.json(profile);
  } catch (err) {
    console.error('[GET /api/profile]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
