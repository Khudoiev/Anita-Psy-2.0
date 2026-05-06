import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { streamChat } from '../../services/sse';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatArea() {
  const { messages, isStreaming, streamingMessage, currentConversationId } = useChatStore();
  const [error, setError] = useState('');

  const handleSend = async (text) => {
    if (!text.trim() || isStreaming) return;
    setError('');
    await streamChat(currentConversationId, text, (err) => setError(err.message));
  };

  return (
    <div className="chat-area">
      <div className="messages">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isStreaming && streamingMessage && (
          <MessageBubble message={{ role: 'assistant', content: streamingMessage }} streaming />
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
