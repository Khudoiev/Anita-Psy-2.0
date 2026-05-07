import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingMessage: '',

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversation: (id) => set({ currentConversationId: id, messages: [] }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  startStreaming: () => set({ isStreaming: true, streamingMessage: '' }),

  appendToStream: (chunk) =>
    set((state) => ({ streamingMessage: state.streamingMessage + chunk })),

  finishStreaming: () => {
    const { streamingMessage } = get();
    if (!streamingMessage.trim()) {
      set({ isStreaming: false, streamingMessage: '' });
      return;
    }
    set((state) => ({
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: streamingMessage.trim(),
          created_at: new Date().toISOString(),
        },
      ],
      isStreaming: false,
      streamingMessage: '',
    }));
  },

  clearStream: () => set({ isStreaming: false, streamingMessage: '' }),
}));
