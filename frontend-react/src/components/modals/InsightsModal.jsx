import { useUIStore } from '../../stores/uiStore';

export default function InsightsModal() {
  const { showInsights, insights, closeInsights } = useUIStore();

  if (!showInsights) return null;

  return (
    <div className="modal-overlay">
      <div id="insights-modal" className="modal show">
        <div className="modal-header">
          <h2>Инсайты сессии 💡</h2>
        </div>
        <div className="modal-body">
          {insights?.length > 0 ? (
            <div className="insights-list">
              {insights.map((insight, idx) => (
                <div key={idx} className="insight-item">
                  <h3>{insight.title}</h3>
                  <p>{insight.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>Недостаточно сообщений для инсайтов.</p>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={closeInsights}>
            Сохранить
          </button>
          <button id="insights-skip-btn" className="btn-secondary" onClick={closeInsights}>
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}
