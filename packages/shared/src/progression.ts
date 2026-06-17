/** XP needed to advance FROM `level` TO `level + 1`. */
export function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(Math.max(1, level), 1.5));
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
}

/** Derive level + progress from a total accumulated XP value. */
export function levelFromTotalXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < 999 && remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level++;
  }
  return { level, xpIntoLevel: remaining, xpForNext: xpForNextLevel(level) };
}
