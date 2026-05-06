import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';

export default function Sidebar() {
  const { user } = useAuthStore();
  const { conversations, currentConversationId, setConversations, setCurrentConversation, setMessages } = useChatStore();
  const { openSettings } = useUIStore();

  const handleNewChat = async () => {
    try {
      const conversation = await api.createConversation();
      const updated = await api.getConversations();
      setConversations(updated);
      setCurrentConversation(conversation.id);
    } catch (error) {
      console.error('New chat error:', error);
    }
  };

  const handleSelectChat = async (id) => {
    try {
      setCurrentConversation(id);
      const data = await api.getConversation(id);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Select chat error:', error);
    }
  };

  const handleDeleteChat = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Удалить разговор?')) return;
    try {
      await api.request(`/conversations/${id}`, { method: 'DELETE' });
      const updated = await api.getConversations();
      setConversations(updated);
      if (currentConversationId === id) setCurrentConversation(null);
    } catch (error) {
      console.error('Delete chat error:', error);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <img src="/logo.svg" alt="Anita" />
          <span>Anita</span>
        </div>
      </div>

      <button id="new-chat-btn" className="new-chat-btn" onClick={handleNewChat}>
        + Новый разговор
      </button>

      <div className="conversations-section">
        <div className="section-label">РАЗГОВОРЫ</div>
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`sidebar-chat-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => handleSelectChat(conv.id)}
            >
              <div className="chat-item-content">
                <span className="chat-title" data-chat-title>
                  {conv.title || 'Новый разговор'}
                </span>
                <span className="chat-date">{formatDate(conv.created_at)}</span>
              </div>
              <button
                className="delete-chat-btn"
                onClick={(e) => handleDeleteChat(e, conv.id)}
                title="Удалить"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">👤</div>
          <div>
            <div className="user-name" data-user-name>{user?.username || '—'}</div>
            <div className="user-sessions">{conversations.length} сессий</div>
          </div>
        </div>
        <div className="sidebar-actions">
          <button id="insights-btn" title="Инсайты">📖</button>
          <button id="settings-btn" onClick={openSettings} title="Настройки">⚙️</button>
        </div>
      </div>
    </div>
  );
}
