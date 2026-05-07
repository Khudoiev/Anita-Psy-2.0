import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { api } from './api';

export async function streamChat(conversationId, userMessage, onError) {
  const store = useChatStore.getState();
  store.startStreaming();

  store.addMessage({
    role: 'user',
    content: userMessage,
    created_at: new Date().toISOString(),
  });

  try {
    await api.saveMessage(conversationId, 'user', userMessage);

    const token = useAuthStore.getState().token;
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId,
        message: userMessage,
      }),
    });

    if (!response.ok) throw new Error('Stream failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            store.finishStreaming();
            const assistantContent = useChatStore.getState().messages.at(-1)?.content;
            if (assistantContent) {
              await api.saveMessage(conversationId, 'assistant', assistantContent)
                .catch(e => console.warn('[Save assistant msg]', e));
            }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const streamText = parsed.content ?? parsed.token ?? null;
            if (streamText) {
              store.appendToStream(streamText);
              continue;
            }
          } catch (e) {
            console.warn('Parse error:', e);
          }
        }
      }
    }

    store.finishStreaming();
  } catch (error) {
    console.error('Stream error:', error);
    store.clearStream();
    if (onError) onError(error);
  }
}
