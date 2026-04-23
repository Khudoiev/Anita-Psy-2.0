const db = require('../db');

async function generateImprovementSuggestions() {
  await db.query('REFRESH MATERIALIZED VIEW technique_stats');

  const stats = await db.query(`
    SELECT * FROM technique_stats
    WHERE total_uses >= 10
    ORDER BY success_rate_pct DESC
  `);

  const suggestions = [];

  for (const t of stats.rows) {
    if (t.success_rate_pct < 40 && t.total_uses >= 20) {
      suggestions.push({
        suggestion_type: 'deprioritize_technique',
        reasoning: `Техника "${t.technique_name}" показывает низкую эффективность: ${t.success_rate_pct}% позитивных исходов из ${t.total_uses} использований`,
        expected_benefit: 'Снижение частоты применения улучшит качество сессий',
        potential_risks: 'Техника может быть эффективна для специфических кейсов — нужен ручной анализ перед применением',
        evidence: t,
      });
    }
    if (t.success_rate_pct > 75 && t.total_uses >= 15) {
      suggestions.push({
        suggestion_type: 'emphasize_technique',
        reasoning: `Техника "${t.technique_name}" показывает высокую эффективность: ${t.success_rate_pct}% из ${t.total_uses} использований`,
        expected_benefit: 'Более частое применение улучшит retention пользователей',
        potential_risks: 'Избыточное использование одной техники снизит разнообразие подхода',
        evidence: t,
      });
    }
  }

  for (const s of suggestions) {
    const exists = await db.query(
      `SELECT id FROM prompt_suggestions WHERE status='pending' AND reasoning=$1`,
      [s.reasoning]
    );
    if (!exists.rows.length) {
      await db.query(`
        INSERT INTO prompt_suggestions
          (suggestion_type, reasoning, expected_benefit, potential_risks, evidence)
        VALUES ($1, $2, $3, $4, $5)
      `, [s.suggestion_type, s.reasoning, s.expected_benefit, s.potential_risks,
          JSON.stringify(s.evidence)]);
    }
  }
  return suggestions;
}

async function getActivePromptOverrides() {
  const result = await db.query(
    `SELECT * FROM prompt_suggestions WHERE status='approved' AND applied_at IS NOT NULL`
  );
  return result.rows;
}

module.exports = { generateImprovementSuggestions, getActivePromptOverrides };
