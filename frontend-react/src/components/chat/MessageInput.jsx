import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const { isStreaming } = useChatStore();

  const handleSubmit = () => {
    if (!text.trim() || isStreaming || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="message-input-area">
      <div className="input-wrapper">
        <textarea
          id="msg-input"
          className="message-input"
          placeholder="Напишите сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
        />
        <button
          id="send-btn"
          className={`send-btn ${text.trim() ? 'active' : ''}`}
          onClick={handleSubmit}
          disabled={!text.trim() || isStreaming}
        >
          ➤
        </button>
      </div>
      <div className="input-disclaimer">
        Anita — не замена живому специалисту. Но поможет разобраться в себе.
      </div>
    </div>
  );
}
