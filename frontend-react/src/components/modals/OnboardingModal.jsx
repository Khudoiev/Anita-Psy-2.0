import { useUIStore } from '../../stores/uiStore';

export default function OnboardingModal() {
  const { showOnboarding, closeOnboarding } = useUIStore();

  if (!showOnboarding) return null;

  return (
    <div className="modal-overlay">
      <div id="onboarding-modal" className="modal show">
        <div className="modal-header">
          <h2>Добро пожаловать 👋</h2>
        </div>
        <div className="modal-body">
          <p>
            Я Anita — твой AI-психолог. Здесь безопасно говорить о
            чём угодно. Я помогу разобраться в себе.
          </p>
          <p>Сессия длится до 25 сообщений. В конце — инсайты.</p>
        </div>
        <div className="modal-actions">
          <button id="onboarding-start-btn" className="btn-primary" onClick={closeOnboarding}>
            Начать
          </button>
          <button id="onboarding-skip-btn" className="btn-secondary" onClick={closeOnboarding}>
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}
