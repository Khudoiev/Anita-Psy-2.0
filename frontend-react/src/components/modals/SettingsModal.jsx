import { useUIStore } from '../../stores/uiStore';

export default function SettingsModal() {
  const { closeSettings } = useUIStore();

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Настройки</h2>
        <p>Настройки профиля — будет в следующей части миграции.</p>
        <button onClick={closeSettings}>Закрыть</button>
      </div>
    </div>
  );
}
