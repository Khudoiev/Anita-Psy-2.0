const db = require('../db');

const CRISIS_PATTERNS = [
  /не хочу (больше )?жить/i,
  /покончить с собой/i,
  /суицид/i,
  /убить себя/i,
  /нет смысла жить/i,
  /хочу умереть/i,
];

const CRISIS_SYSTEM_INJECTION =
  '\n\n⚠️ CRISIS PROTOCOL АКТИВИРОВАН: Пользователь выразил кризисные мысли. ' +
  'НЕМЕДЛЕННО: 1) Признать боль без оценки. ' +
  '2) Заземление — дыхание, "здесь и сейчас". ' +
  '3) Дать ресурсы кризисной помощи: 8-800-2000-122 (бесплатно, 24/7). ' +
  '4) Только присутствие — никаких советов и анализа.';

async function checkAndLogCrisis(message, userId, conversationId) {
  const isCrisis = CRISIS_PATTERNS.some(p => p.test(message));
  if (!isCrisis) return { isCrisis: false };

  await db.query(
    `INSERT INTO crisis_events (user_id, conversation_id, trigger_phrase)
     VALUES ($1, $2, $3)`,
    [userId || null, conversationId || null, message.slice(0, 200)]
  );

  return { isCrisis: true, systemInjection: CRISIS_SYSTEM_INJECTION };
}

module.exports = { checkAndLogCrisis };
