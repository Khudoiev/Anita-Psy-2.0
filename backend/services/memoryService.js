const db = require('../db');

async function getUserMemoryContext(userId) {
  const profile = await getProfile(userId);

  const result = await db.query(`
    SELECT fact, category, importance
    FROM user_memory
    WHERE user_id=$1 AND is_active=true AND fact != 'User Profile'
    ORDER BY
      CASE importance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      times_referenced DESC,
      last_referenced DESC NULLS LAST
    LIMIT 15
  `, [userId]);

  const name = profile?.name || null;
  const lastMood = profile?.mood_history?.at(-1)?.score ?? null;
  const themes = profile?.themes?.length ? profile.themes.join(', ') : null;
  const triggers = profile?.triggers?.length ? profile.triggers.join(', ') : null;

  let context = '## ПАМЯТЬ О ЧЕЛОВЕКЕ\n\n';
  context += `ИМЯ: ${name || 'не указано — спроси органично если возникнет момент'}\n`;
  context += `ТЕМЫ ИЗ ПРОШЛЫХ РАЗГОВОРОВ: ${themes || 'нет'}\n`;
  context += `ТРИГГЕРЫ: ${triggers || 'нет'}\n`;
  context += `ПОСЛЕДНЕЕ НАСТРОЕНИЕ: ${lastMood !== null ? `${lastMood}/10` : 'нет данных'}\n`;

  if (result.rows.length) {
    context += 'ВАЖНЫЕ ФАКТЫ:\n';
    result.rows.forEach(row => {
      context += `- [${row.category}] ${row.fact}\n`;
    });
  } else {
    context += 'ВАЖНЫЕ ФАКТЫ: нет\n';
  }

  return context;
}

async function saveFacts(userId, conversationId, extractedMemory) {
  if (!extractedMemory?.facts?.length) return;
  for (const fact of extractedMemory.facts) {
    const existing = await db.query(
      'SELECT id FROM user_memory WHERE user_id=$1 AND LOWER(fact)=LOWER($2)',
      [userId, fact.fact]
    );
    if (existing.rows.length) continue;
    await db.query(`
      INSERT INTO user_memory (user_id, category, fact, importance, source_conversation_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, fact.category, fact.fact, fact.importance, conversationId || null]);
  }
}

async function touchMemoryFacts(userId, factsUsed) {
  if (!factsUsed?.length) return;
  await db.query(`
    UPDATE user_memory
    SET last_referenced=NOW(), times_referenced=times_referenced+1
    WHERE user_id=$1 AND fact=ANY($2)
  `, [userId, factsUsed]);
}

const defaultProfile = {
  name: null,
  core_issues: [],
  triggers: [],
  progress: "",
  personality_notes: "",
  preferred_techniques: [],
  mood_history: [],
  insights_history: [],
  themes: [],
  techniques: [],
  is_onboarded: false
};

async function getProfile(userId) {
  const result = await db.query(
    "SELECT profile FROM user_memory WHERE user_id = $1 AND fact = 'User Profile' LIMIT 1",
    [userId]
  );
  if (!result.rows.length || !result.rows[0].profile) {
    return { ...defaultProfile };
  }
  return result.rows[0].profile;
}

async function updateProfile(userId, updates) {
  const currentProfile = await getProfile(userId);
  
  const newProfile = { ...currentProfile };
  for (const key of Object.keys(updates)) {
    if (['core_issues', 'triggers', 'preferred_techniques', 'themes', 'techniques'].includes(key)) {
      const currentArr = Array.isArray(newProfile[key]) ? newProfile[key] : [];
      const updateArr = Array.isArray(updates[key]) ? updates[key] : [updates[key]];
      const newItems = updateArr.filter(item => !currentArr.includes(item));
      newProfile[key] = [...currentArr, ...newItems];
    } else if (['mood_history', 'insights_history'].includes(key)) {
      const currentArr = Array.isArray(newProfile[key]) ? newProfile[key] : [];
      const updateArr = Array.isArray(updates[key]) ? updates[key] : [updates[key]];
      newProfile[key] = [...currentArr, ...updateArr];
    } else {
      newProfile[key] = updates[key];
    }
  }

  const updateResult = await db.query(
    "UPDATE user_memory SET profile = $1 WHERE user_id = $2 AND fact = 'User Profile'",
    [newProfile, userId]
  );
  
  if (updateResult.rowCount === 0) {
    await db.query(
      `INSERT INTO user_memory (user_id, fact, category, importance, profile) 
       VALUES ($1, 'User Profile', 'personal', 'low', $2)`,
      [userId, newProfile]
    );
  }
  
  return newProfile;
}

module.exports = { getUserMemoryContext, saveFacts, touchMemoryFacts, getProfile, updateProfile };
