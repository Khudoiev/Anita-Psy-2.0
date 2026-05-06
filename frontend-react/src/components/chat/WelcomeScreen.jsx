import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

export default function WelcomeScreen() {
  const { user } = useAuthStore();
  const { openSettings } = useUIStore();

  return (
    <div className="welcome-screen">
      <h1>Привет, {user?.username || 'гость'}</h1>
      <p>Выбери сеанс слева или начни новый разговор с Anita.</p>
      <button onClick={openSettings}>Настройки</button>
    </div>
  );
}
