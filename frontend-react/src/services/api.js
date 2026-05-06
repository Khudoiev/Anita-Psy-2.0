import { useAuthStore } from '../stores/authStore';

class APIService {
  constructor() {
    this.baseURL = '/api';
  }

  async request(endpoint, options = {}) {
    const token = useAuthStore.getState().token;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async join(token) {
    return this.request('/auth/join', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // register требует guestToken как Authorization header (/api/auth/register — requireAuth)
  async register(username, password, secretQuestion, secretAnswer, guestToken) {
    return this.request('/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestToken}` },
      body: JSON.stringify({ username, password, secretQuestion, secretAnswer }),
    });
  }

  async login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Conversations
  async getConversations() {
    return this.request('/conversations');
  }

  async createConversation() {
    return this.request('/conversations', { method: 'POST' });
  }

  async getConversation(id) {
    return this.request(`/conversations/${id}`);
  }

  async saveMessage(conversationId, role, content) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content }),
    });
  }

  async endSession(conversationId) {
    return this.request(`/conversations/${conversationId}/end`, {
      method: 'POST',
    });
  }

  // Memory
  async getMemory() {
    return this.request('/conversations/memory');
  }
}

export const api = new APIService();
