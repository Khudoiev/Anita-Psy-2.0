import { useChatStore } from '../../stores/chatStore';
import { api } from '../../services/api';

const QUOTES = [
  '«Не всё, что переживается, можно изменить. Но ничего нельзя изменить, пока не переживёшь.» — Дж. Болдуин',
  '«Знать себя — начало всякой мудрости.» — Аристотель',
];

export default function WelcomeScreen() {
  const { setCurrentConversation, conversations, setConversations } = useChatStore();

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  const handleStartChat = async () => {
    try {
      const conversation = await api.createConversation();
      const updated = await api.getConversations();
      setConversations(updated);
      setCurrentConversation(conversation.id);
    } catch (error) {
      console.error('Start chat error:', error);
    }
  };

  const recentChats = conversations.slice(0, 3);

  return (
    <div className="welcome-screen">
      <div className="welcome-logo">
        <img src="/avatar.png" alt="Anita" className="welcome-avatar" />
      </div>

      <h1 className="welcome-title">Anita</h1>
      <p className="welcome-subtitle">AI Психолог · Твоя поддержка</p>

      <blockquote className="welcome-quote">{quote}</blockquote>

      <button className="start-chat-btn" onClick={handleStartChat}>
        Начать разговор
      </button>

      {recentChats.length > 0 && (
        <div className="recent-chats-section">
          <div className="section-label">НЕДАВНИЕ РАЗГОВОРЫ</div>
          <div className="recent-chats-grid">
            {recentChats.map((conv) => (
              <div
                key={conv.id}
                className="recent-chat-card"
                onClick={() => setCurrentConversation(conv.id)}
              >
                <div>{conv.title || 'Новый разговор'}</div>
                <div className="chat-meta">{conv.message_count || 0} сообщ.</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
