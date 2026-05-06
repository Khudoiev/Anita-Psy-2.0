import { useState, useEffect } from 'react';

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem('anita_admin_token')
  );
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });

  useEffect(() => {
    if (adminToken) loadUsers();
  }, [adminToken]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('anita_admin_token', data.token);
        setAdminToken(data.token);
      }
    } catch {
      alert('Ошибка входа');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (error) {
      console.error('Load users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Удалить пользователя?')) return;
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      loadUsers();
    } catch {
      alert('Ошибка удаления');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('anita_admin_token');
    setAdminToken(null);
  };

  if (!adminToken) {
    return (
      <div className="admin-login">
        <h2>Anita Admin</h2>
        <form onSubmit={handleAdminLogin}>
          <input
            placeholder="Username"
            value={loginData.username}
            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          />
          <button type="submit">Войти</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Anita Admin</h1>
        <button onClick={handleLogout}>Выйти</button>
      </div>

      <div className="admin-content">
        <h2>Пользователи</h2>
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Никнейм</th>
                <th>Страна</th>
                <th>Устройство</th>
                <th>Сессий</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName || user.username}</td>
                  <td>{user.country || '—'}</td>
                  <td>{user.device || '—'}</td>
                  <td>{user.sessions_count || 0}</td>
                  <td>
                    <span className={`status-badge ${user.is_online ? 'online' : 'offline'}`}>
                      {user.is_online ? 'Онлайн' : 'Оффлайн'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleDeleteUser(user.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
