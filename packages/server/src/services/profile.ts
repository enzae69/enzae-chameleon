import { isFirebaseEnabled, getDb } from "../firebase";
import {
  UserProfile,
  PlayerStats,
  EMPTY_STATS,
  DEFAULT_INVENTORY,
  levelFromTotalXp,
} from "@enzae/shared";

export function defaultProfile(uid: string, displayName: string, isGuest: boolean): UserProfile {
  const now = Date.now();
  return {
    uid,
    displayName,
    photoURL: null,
    isGuest,
    role: "user",
    xp: 0,
    coins: 0,
    banned: false,
    banReason: null,
    stats: { ...EMPTY_STATS },
    cosmetics: { ...DEFAULT_INVENTORY },
    createdAt: now,
    updatedAt: now,
  };
}

/** Load a profile from Firestore, creating a default document on first login. */
export async function getOrCreateProfile(
  uid: string,
  displayName: string,
  isGuest: boolean
): Promise<UserProfile> {
  if (isGuest || !isFirebaseEnabled()) return defaultProfile(uid, displayName, isGuest);

  const db = getDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const profile = defaultProfile(uid, displayName, false);
    await ref.set(profile, { merge: true });
    return profile;
  }

  const data = snap.data() as Partial<UserProfile>;
  return { ...defaultProfile(uid, displayName, false), ...data, uid } as UserProfile;
}

export interface MatchResult {
  xpGained: number;
  stats: Partial<PlayerStats>;
}

/**
 * Atomically apply match rewards to a user and refresh their leaderboard mirror.
 * No-op for guests or when Firebase is disabled. Failures are swallowed so a
 * persistence hiccup can never crash a live match.
 */
export async function awardMatchResults(
  uid: string,
  isGuest: boolean,
  result: MatchResult
): Promise<void> {
  if (isGuest || !isFirebaseEnabled()) return;

  try {
    const db = getDb();
    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = db.collection("users").doc(uid);

    const statsInc: Record<string, FirebaseFirestore.FieldValue> = {};
    for (const [key, value] of Object.entries(result.stats)) {
      if (typeof value === "number" && value !== 0) {
        statsInc[key] = FieldValue.increment(value);
      }
    }

    await ref.set(
      {
        xp: FieldValue.increment(result.xpGained),
        updatedAt: Date.now(),
        stats: statsInc,
      },
      { merge: true }
    );

    const fresh = await ref.get();
    const p = fresh.data() as UserProfile | undefined;
    if (p) {
      const { level } = levelFromTotalXp(p.xp || 0);
      await db
        .collection("leaderboard")
        .doc(uid)
        .set(
          {
            uid,
            displayName: p.displayName,
            photoURL: p.photoURL ?? null,
            level,
            xp: p.xp || 0,
            wins: p.stats?.wins || 0,
          },
          { merge: true }
        );
    }
  } catch (err) {
    console.error("[profile] awardMatchResults failed:", err);
  }
}
