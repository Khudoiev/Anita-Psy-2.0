import { useUIStore } from '../../stores/uiStore';

export default function OnboardingModal() {
  const { closeOnboarding } = useUIStore();

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Добро пожаловать!</h2>
        <p>Я — Anita, твой личный психолог. Расскажи мне о себе.</p>
        <button onClick={closeOnboarding}>Начать</button>
      </div>
    </div>
  );
}
