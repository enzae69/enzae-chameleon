import { create } from "zustand";
import type { WeaponType } from "@enzae/shared";

export interface ShotFx {
  id: number;
  weapon: WeaponType;
  from: [number, number, number];
  to: [number, number, number];
  hit: boolean;
}

interface EffectsStore {
  shots: ShotFx[];
  spawnShot: (s: Omit<ShotFx, "id">) => void;
  removeShot: (id: number) => void;
}

let seq = 1;

/** Transient weapon-beam effects, kept tiny and outside the game store. */
export const useEffects = create<EffectsStore>((set) => ({
  shots: [],
  spawnShot: (s) =>
    set((st) => ({ shots: [...st.shots.slice(-11), { ...s, id: seq++ }] })),
  removeShot: (id) => set((st) => ({ shots: st.shots.filter((x) => x.id !== id) })),
}));
