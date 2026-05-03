const { getProfile, updateProfile } = require('./memoryService');

async function parseProfileBackground(userId, messages) {
  try {
    const profile = await getProfile(userId);
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
    
    // Mood check logic:
    if (profile.is_onboarded && userMessages.length <= 2) {
      const match = lastUserMessage.match(/\b([1-9]|10)\b/);
      if (match) {
        const score = parseInt(match[0], 10);
        await updateProfile(userId, { mood_history: [{ date: new Date().toISOString(), score }] });
        return; // Successfully parsed mood
      }
    }

    // Onboarding parse logic:
    if (!profile.is_onboarded && lastUserMessage) {
      const prompt = `Ты анализируешь ответ пользователя во время онбординга.
Извлеки из этого ответа данные профиля и верни ТОЛЬКО JSON формат без лишнего текста и markdown:
{
  "name": "имя если есть, иначе null",
  "core_issues": ["проблема 1", "проблема 2"] или [],
  "triggers": ["триггер 1", "триггер 2"] или []
}
Ответ пользователя: "${lastUserMessage}"`;

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROK_MODEL || 'grok-4.20-reasoning',
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.1,
          max_tokens: 200,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        let parsed;
        try {
          const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Profile Parser] JSON parse error', e, content);
        }

        if (parsed) {
          const updates = {};
          if (parsed.name && !profile.name) updates.name = parsed.name;
          if (parsed.core_issues && parsed.core_issues.length) updates.core_issues = parsed.core_issues;
          if (parsed.triggers && parsed.triggers.length) updates.triggers = parsed.triggers;

          if (Object.keys(updates).length > 0) {
            await updateProfile(userId, updates);
          }
        }
      }

      // Complete onboarding if we had enough messages
      if (userMessages.length >= 4) {
        await updateProfile(userId, { is_onboarded: true });
      }
    }
  } catch (err) {
    console.error('[Profile Parser] Error', err);
  }
}

module.exports = { parseProfileBackground };
