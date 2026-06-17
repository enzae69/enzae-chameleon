import { getAuth, isFirebaseEnabled } from "./firebase";

export interface DecodedUser {
  uid: string;
  name?: string;
  picture?: string;
}

/** Verify a Firebase ID token. Returns null when invalid or when Firebase is disabled. */
export async function verifyIdToken(token?: string): Promise<DecodedUser | null> {
  if (!token || !isFirebaseEnabled()) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      name: (decoded.name as string | undefined) ?? undefined,
      picture: (decoded.picture as string | undefined) ?? undefined,
    };
  } catch {
    return null;
  }
}
