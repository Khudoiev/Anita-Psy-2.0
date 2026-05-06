import { useUIStore } from '../../stores/uiStore';

export default function InsightsModal() {
  const { insights, closeInsights } = useUIStore();

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Инсайты сеанса</h2>
        <div className="insights-content">
          {insights ? (
            <p>{typeof insights === 'string' ? insights : JSON.stringify(insights, null, 2)}</p>
          ) : (
            <p>Нет данных</p>
          )}
        </div>
        <button onClick={closeInsights}>Закрыть</button>
      </div>
    </div>
  );
}
