import { create } from "zustand";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";

export interface AuthUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  isGuest: boolean;
}

interface AuthState {
  ready: boolean;
  user: AuthUser | null;
  firebaseEnabled: boolean;
  init: () => void;
  registerEmail: (email: string, password: string, name: string) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  playGuest: (name?: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | undefined>;
}

const GUEST_KEY = "enzae_guest";

function randomGuestName(): string {
  return "Chameleon" + Math.floor(1000 + Math.random() * 9000);
}

function loadLocalGuest(): AuthUser | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  firebaseEnabled,

  init: () => {
    if (firebaseEnabled && auth) {
      onAuthStateChanged(auth, (u) => {
        if (u) {
          set({
            user: {
              uid: u.uid,
              displayName: u.displayName || randomGuestName(),
              photoURL: u.photoURL,
              isGuest: u.isAnonymous,
            },
            ready: true,
          });
        } else {
          set({ user: null, ready: true });
        }
      });
    } else {
      // Guest-only mode: restore a persisted local identity if present.
      set({ user: loadLocalGuest(), ready: true });
    }
  },

  registerEmail: async (email, password, name) => {
    if (!auth) throw new Error("Firebase nicht konfiguriert");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name.slice(0, 16) });
    set((s) => ({ user: s.user ? { ...s.user, displayName: name } : s.user }));
  },

  loginEmail: async (email, password) => {
    if (!auth) throw new Error("Firebase nicht konfiguriert");
    await signInWithEmailAndPassword(auth, email, password);
  },

  loginGoogle: async () => {
    if (!auth) throw new Error("Firebase nicht konfiguriert");
    await signInWithPopup(auth, new GoogleAuthProvider());
  },

  playGuest: async (name) => {
    const displayName = (name || randomGuestName()).slice(0, 16);
    if (firebaseEnabled && auth) {
      const cred = await signInAnonymously(auth);
      await updateProfile(cred.user, { displayName });
      set({ user: { uid: cred.user.uid, displayName, photoURL: null, isGuest: true } });
    } else {
      const user: AuthUser = {
        uid: "guest_" + Math.random().toString(36).slice(2, 10),
        displayName,
        photoURL: null,
        isGuest: true,
      };
      localStorage.setItem(GUEST_KEY, JSON.stringify(user));
      set({ user });
    }
  },

  logout: async () => {
    if (firebaseEnabled && auth) await signOut(auth);
    else {
      localStorage.removeItem(GUEST_KEY);
      set({ user: null });
    }
  },

  getToken: async () => {
    if (firebaseEnabled && auth?.currentUser) return auth.currentUser.getIdToken();
    return undefined;
  },
}));

/** Build the join options handed to the server (token if signed in, else guest name). */
export async function buildJoinAuth(): Promise<{ token?: string; guestName: string }> {
  const { user, getToken } = useAuth.getState();
  const token = await getToken();
  return { token, guestName: user?.displayName || "Spieler" };
}
