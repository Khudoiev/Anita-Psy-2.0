import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

export default function SettingsModal() {
  const { showSettings, closeSettings } = useUIStore();
  const { logout } = useAuthStore();

  if (!showSettings) return null;

  const handleLogout = () => {
    if (!confirm('Выйти из аккаунта?')) return;
    closeSettings();
    logout();
    window.location.href = '/';
  };

  return (
    <div className="modal-overlay" onClick={closeSettings}>
      <div
        id="settings-modal"
        className="modal show"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Настройки</h2>
          <button id="settings-close-btn" onClick={closeSettings}>✕</button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>Аккаунт</h3>
            <p>Здесь будут настройки аккаунта.</p>
          </div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
          <button
            id="logout-btn"
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(255,80,80,0.1)',
              border: '1px solid rgba(255,80,80,0.2)',
              borderRadius: 'var(--r-element)',
              color: '#ffbaba',
              cursor: 'pointer',
            }}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
