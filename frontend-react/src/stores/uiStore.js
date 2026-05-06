import { create } from 'zustand';

export const useUIStore = create((set) => ({
  showOnboarding: false,
  showInsights: false,
  showSettings: false,
  insights: null,

  openOnboarding: () => set({ showOnboarding: true }),
  closeOnboarding: () => set({ showOnboarding: false }),

  openInsights: (insights) => set({ showInsights: true, insights }),
  closeInsights: () => set({ showInsights: false, insights: null }),

  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
}));
