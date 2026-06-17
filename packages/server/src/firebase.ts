import admin from "firebase-admin";

let enabled = false;

/**
 * Initialise the Firebase Admin SDK from environment variables.
 * If no credentials are provided the server keeps running in GUEST-ONLY
 * mode: no token verification, no persistence — perfect for local dev and
 * for the very first deploy before Firebase has been configured.
 */
export function initFirebase(): void {
  if (admin.apps.length) {
    enabled = true;
    return;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  try {
    if (raw) {
      const json = raw.startsWith("{")
        ? JSON.parse(raw)
        : JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
      admin.initializeApp({ credential: admin.credential.cert(json) });
      enabled = true;
    } else if (projectId && clientEmail && privateKey) {
      privateKey = privateKey.replace(/\\n/g, "\n");
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      enabled = true;
    } else {
      console.warn(
        "[firebase] No credentials found — running in GUEST-ONLY mode (no auth, no persistence)."
      );
      enabled = false;
    }
  } catch (err) {
    console.error("[firebase] Init failed, falling back to guest-only mode:", err);
    enabled = false;
  }

  if (enabled) console.log("[firebase] Admin SDK initialised.");
}

export function isFirebaseEnabled(): boolean {
  return enabled;
}

export function getAuth() {
  return admin.auth();
}

export function getDb() {
  return admin.firestore();
}

export { admin };
