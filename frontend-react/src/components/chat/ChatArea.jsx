import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import { streamChat } from '../../services/sse';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatArea() {
  const {
    currentConversationId,
    messages,
    isStreaming,
    streamingMessage,
    setMessages,
  } = useChatStore();
  const { openInsights } = useUIStore();
  const messagesEndRef = useRef(null);
  const [sessionMessageCount, setSessionMessageCount] = useState(0);
  const [endingSession, setEndingSession] = useState(false);

  useEffect(() => {
    if (!currentConversationId) return;
    if (isStreaming) return;
    loadMessages();
  }, [currentConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const loadMessages = async () => {
    try {
      const data = await api.getConversation(currentConversationId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const handleSend = async (text) => {
    if (!currentConversationId) return;
    setSessionMessageCount((c) => c + 1);
    await streamChat(currentConversationId, text, (error) => {
      console.error('Stream error:', error);
    });
  };

  const handleEndSession = async () => {
    if (!currentConversationId || endingSession) return;
    setEndingSession(true);
    try {
      const data = await api.endSession(currentConversationId);
      if (data.insights?.length > 0) {
        openInsights(data.insights);
      }
    } catch (error) {
      console.error('End session error:', error);
    } finally {
      setEndingSession(false);
    }
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="chat-info">
          <div className="anita-avatar">
            <img src="/avatar.png" alt="Anita" />
          </div>
          <div>
            <div className="anita-name">Anita</div>
            <div className="anita-status">AI Психолог · Онлайн</div>
          </div>
          <div className="session-counter">
            Ход {sessionMessageCount} /25
          </div>
        </div>
        <button
          id="end-session-btn"
          className="end-session-btn"
          onClick={handleEndSession}
          disabled={endingSession}
          data-end-session
        >
          {endingSession ? 'Завершение...' : 'Завершить сеанс'}
        </button>
      </div>

      <div className="messages-container">
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {isStreaming && streamingMessage && (
          <MessageBubble message={{ role: 'assistant', content: streamingMessage }} />
        )}

        {isStreaming && !streamingMessage && (
          <div className="typing-indicator" data-role="assistant">
            <span></span><span></span><span></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} disabled={!currentConversationId} />
    </div>
  );
}
