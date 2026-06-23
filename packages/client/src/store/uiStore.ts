import { create } from "zustand";

export type Screen = "menu" | "browser" | "create" | "profile" | "leaderboard";

interface UIState {
  screen: Screen;
  toast: string | null;
  paintMode: boolean; // hider "paint yourself" mode: zooms in + shows the palette
  setScreen: (s: Screen) => void;
  setPaintMode: (on: boolean) => void;
  showToast: (msg: string) => void;
}

export const useUI = create<UIState>((set) => ({
  screen: "menu",
  toast: null,
  paintMode: false,
  setScreen: (screen) => set({ screen }),
  setPaintMode: (paintMode) => set({ paintMode }),
  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : {})), 2600);
  },
}));
