import { useState } from 'react';

export default function RegisterForm({ guestToken, onSubmit, onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secretQuestion, setSecretQuestion] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // guestToken передаётся в onSubmit — нужен как Authorization header для /api/auth/register
      await onSubmit(username, password, secretQuestion, secretAnswer, guestToken);
    } catch (err) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  if (!guestToken) {
    return (
      <div className="auth-form">
        <p>Для регистрации нужна инвайт-ссылка</p>
        <button onClick={onSwitchToLogin}>Назад ко входу</button>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2>Регистрация</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          id="username"
          placeholder="Логин"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          name="password"
          id="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="text"
          id="secret-question"
          placeholder="Секретный вопрос"
          value={secretQuestion}
          onChange={(e) => setSecretQuestion(e.target.value)}
          required
        />
        <input
          type="text"
          id="secret-answer"
          placeholder="Ответ"
          value={secretAnswer}
          onChange={(e) => setSecretAnswer(e.target.value)}
          required
        />
        <button type="submit" id="register-btn" disabled={loading}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  );
}
