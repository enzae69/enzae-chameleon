import { create } from "zustand";

export type Screen = "menu" | "browser" | "create" | "profile" | "leaderboard";

interface UIState {
  screen: Screen;
  toast: string | null;
  setScreen: (s: Screen) => void;
  showToast: (msg: string) => void;
}

export const useUI = create<UIState>((set) => ({
  screen: "menu",
  toast: null,
  setScreen: (screen) => set({ screen }),
  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : {})), 2600);
  },
}));
