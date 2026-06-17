import { useState } from "react";
import { useAuth } from "../store/authStore";
import { Background, Logo } from "./components/Layout";

function humanizeError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "E-Mail oder Passwort falsch.";
  if (code.includes("email-already-in-use")) return "Diese E-Mail ist bereits registriert.";
  if (code.includes("weak-password")) return "Passwort zu schwach (min. 6 Zeichen).";
  if (code.includes("invalid-email")) return "Ungültige E-Mail-Adresse.";
  return (e as Error)?.message || "Etwas ist schiefgelaufen.";
}

export default function AuthScreen() {
  const { firebaseEnabled, registerEmail, loginEmail, loginGoogle, playGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Background>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="text-center">
          <Logo size="text-5xl" />
          <p className="mt-2 text-white/60">Verstecken. Tarnen. Überleben.</p>
        </div>

        <div className="card w-full max-w-sm">
          {firebaseEnabled ? (
            <>
              <div className="mb-4 flex rounded-xl bg-black/30 p-1 text-sm">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-lg py-2 font-semibold transition ${
                      mode === m ? "bg-cham-500 text-white" : "text-white/60"
                    }`}
                  >
                    {m === "login" ? "Anmelden" : "Registrieren"}
                  </button>
                ))}
              </div>

              {mode === "register" && (
                <input
                  className="input mb-3"
                  placeholder="Anzeigename"
                  maxLength={16}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <input
                className="input mb-3"
                placeholder="E-Mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input mb-3"
                placeholder="Passwort"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {err && <p className="mb-3 text-sm text-red-300">{err}</p>}

              <button
                className="btn-primary w-full"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    mode === "register"
                      ? registerEmail(email, password, name || "Spieler")
                      : loginEmail(email, password)
                  )
                }
              >
                {mode === "register" ? "Konto erstellen" : "Anmelden"}
              </button>

              <button className="btn-ghost mt-3 w-full" disabled={busy} onClick={() => run(loginGoogle)}>
                Mit Google fortfahren
              </button>

              <div className="my-4 flex items-center gap-3 text-xs text-white/40">
                <div className="h-px flex-1 bg-white/15" /> oder <div className="h-px flex-1 bg-white/15" />
              </div>
            </>
          ) : (
            <p className="mb-4 text-center text-sm text-white/60">
              Firebase ist nicht konfiguriert – du spielst im Gastmodus. (Konten &amp; Fortschritt
              aktivierst du, indem du die Firebase-Keys einträgst.)
            </p>
          )}

          <input
            className="input mb-3"
            placeholder="Gast-Name"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-ghost w-full" disabled={busy} onClick={() => run(() => playGuest(name))}>
            Als Gast spielen
          </button>
        </div>
      </div>
    </Background>
  );
}
