import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [guestToken, setGuestToken] = useState(null);
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/chat');
      return;
    }
    const inviteToken = searchParams.get('token') || searchParams.get('invite');
    if (inviteToken) {
      handleInvite(inviteToken);
    }
  }, []);

  const handleInvite = async (token) => {
    try {
      const data = await api.join(token);
      setGuestToken(data.token);
      setMode('register');
    } catch {
      alert('Инвайт-токен недействителен');
    }
  };

  const handleLogin = async (username, password) => {
    const data = await api.login(username, password);
    setAuth(data.token, data.username);
    navigate('/chat');
  };

  // guestToken передаётся пятым аргументом из RegisterForm.handleSubmit
  const handleRegister = async (username, password, secretQuestion, secretAnswer, token) => {
    const data = await api.register(username, password, secretQuestion, secretAnswer, token);
    setAuth(data.token, data.username);
    navigate('/chat');
  };

  return (
    <div className="auth-page">
      {mode === 'login' ? (
        <LoginForm onSubmit={handleLogin} onSwitchToRegister={() => setMode('register')} />
      ) : (
        <RegisterForm
          guestToken={guestToken}
          onSubmit={handleRegister}
          onSwitchToLogin={() => setMode('login')}
        />
      )}
    </div>
  );
}
