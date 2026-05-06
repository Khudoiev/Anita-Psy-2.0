import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, username) => set({ token, user: { username } }),

      logout: () => {
        set({ token: null, user: null });
        localStorage.removeItem('anita_profile');
        localStorage.removeItem('anita_last_chat');
      },

      isAuthenticated: () => {
        const { token } = get();
        if (!token) return false;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.exp * 1000 > Date.now();
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'anita_jwt',
    }
  )
);
