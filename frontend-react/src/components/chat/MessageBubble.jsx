export default function MessageBubble({ message, streaming = false }) {
  return (
    <div className={`message message-${message.role}${streaming ? ' streaming' : ''}`}>
      <div className="message-content">{message.content}</div>
    </div>
  );
}
