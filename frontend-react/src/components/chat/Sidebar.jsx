import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

export default function Sidebar() {
  const { conversations, setCurrentConversation, setMessages, setConversations } = useChatStore();
  const { user, logout } = useAuthStore();

  const handleNewChat = async () => {
    try {
      const conv = await api.createConversation();
      const updated = await api.getConversations();
      setConversations(updated);
      setCurrentConversation(conv.id);
    } catch (err) {
      console.error('New chat error:', err);
    }
  };

  const handleSelectConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(id);
      setMessages(conv.messages || []);
    } catch (err) {
      console.error('Load conversation error:', err);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="username">{user?.username}</span>
        <button onClick={handleNewChat}>+ Новый сеанс</button>
      </div>
      <div className="conversation-list">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className="conversation-item"
            onClick={() => handleSelectConversation(conv.id)}
          >
            Сеанс {new Date(conv.created_at).toLocaleDateString('ru')}
          </div>
        ))}
      </div>
      <button className="logout-btn" onClick={logout}>Выйти</button>
    </div>
  );
}
