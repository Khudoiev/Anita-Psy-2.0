const db = require('../db');

const TECHNIQUE_MARKERS = {
  'CBT':           [/когнитивн/i, /автоматическ.*мысл/i, /искажени/i],
  'ACT':           [/принятие/i, /ценност/i, /дефьюжн/i],
  'gestalt':       [/здесь и сейчас/i, /незавершённ/i, /чувствуешь прямо сейчас/i],
  'IFS':           [/часть тебя/i, /внутренн.*голос/i, /менеджер/i],
  'narrative':     [/твоя история/i, /перепиши/i, /как бы назвал/i],
  'somatic':       [/тело/i, /ощущени.*теле/i, /заземлени/i, /дыхани/i],
  'psychodynamic': [/в детстве/i, /паттерн/i, /защитн/i],
  'motivational':  [/что мешает/i, /готов.*изменени/i, /амбивалентн/i],
  'SFBT':          [/чудесный вопрос/i, /что уже работает/i],
  'DBT':           [/регуляци.*эмоц/i, /толерантност/i, /майндфулнес/i],
};

async function detectAndSaveTechniques(responseText, conversationId, sessionTurn) {
  if (!conversationId) return;

  // Check consent before saving analytics
  try {
    const convRes = await db.query(
      'SELECT user_id FROM conversations WHERE id=$1', [conversationId]
    );
    if (convRes.rows.length) {
      const userId = convRes.rows[0].user_id;
      const consent = await db.query(
        'SELECT ai_improvement FROM user_consent WHERE user_id=$1', [userId]
      );
      if (!consent.rows[0]?.ai_improvement) return;
    }
  } catch (e) {
    return; // tables may not exist yet
  }

  for (const [technique, patterns] of Object.entries(TECHNIQUE_MARKERS)) {
    if (patterns.some(p => p.test(responseText))) {
      await db.query(
        `INSERT INTO technique_outcomes (conversation_id, technique_name, session_turn)
         VALUES ($1, $2, $3)`,
        [conversationId, technique, sessionTurn]
      );
    }
  }
}

async function updateTechniqueOutcome(conversationId, outcome) {
  await db.query(
    `UPDATE technique_outcomes SET outcome=$1
     WHERE conversation_id=$2 AND outcome IS NULL`,
    [outcome, conversationId]
  );
}

module.exports = { detectAndSaveTechniques, updateTechniqueOutcome };
