export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`} data-role={message.role}>
      {!isUser && (
        <div className="message-avatar">
          <img src="/avatar.png" alt="Anita" />
        </div>
      )}
      <div className="message-content">
        <div className="message-text">{message.content}</div>
        {time && <div className="message-time">{time}</div>}
      </div>
    </div>
  );
}
