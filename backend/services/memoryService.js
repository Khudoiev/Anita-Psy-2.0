const db = require('../db');

async function getUserMemoryContext(userId) {
  const result = await db.query(`
    SELECT fact, category, importance
    FROM user_memory
    WHERE user_id=$1 AND is_active=true
    ORDER BY
      CASE importance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      times_referenced DESC,
      last_referenced DESC NULLS LAST
    LIMIT 15
  `, [userId]);

  if (!result.rows.length) return '';

  const byCategory = result.rows.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row.fact);
    return acc;
  }, {});

  let context = 'КОНТЕКСТ О ПОЛЬЗОВАТЕЛЕ (из предыдущих сессий):\n';
  for (const [cat, facts] of Object.entries(byCategory)) {
    context += `[${cat}]: ${facts.join('; ')}\n`;
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
  is_onboarded: false
};

async function getProfile(userId) {
  const result = await db.query('SELECT profile FROM user_memory WHERE user_id = $1 AND profile IS NOT NULL LIMIT 1', [userId]);
  if (!result.rows.length || !result.rows[0].profile) {
    return { ...defaultProfile };
  }
  return result.rows[0].profile;
}

async function updateProfile(userId, updates) {
  const currentProfile = await getProfile(userId);
  
  const newProfile = { ...currentProfile };
  for (const key of Object.keys(updates)) {
    if (['core_issues', 'triggers', 'preferred_techniques'].includes(key)) {
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

  const updateResult = await db.query('UPDATE user_memory SET profile = $1 WHERE user_id = $2', [newProfile, userId]);
  
  if (updateResult.rowCount === 0) {
    await db.query(
      `INSERT INTO user_memory (user_id, fact, category, importance, profile) 
       VALUES ($1, 'User profile initialized', 'personal', 'low', $2)`,
      [userId, newProfile]
    );
  }
  
  return newProfile;
}

module.exports = { getUserMemoryContext, saveFacts, touchMemoryFacts, getProfile, updateProfile };
