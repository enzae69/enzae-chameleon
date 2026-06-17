# 🦎 enzae Chameleon

Ein 3D-Multiplayer-**Versteck-Spiel** fürs Web. **Hider** tarnen sich, indem sie
ihre Farbe ändern und die Farbe von Objekten kopieren – **Seeker** jagen,
markieren und eliminieren sie in Echtzeit.

> Läuft sofort im **Gastmodus** (ohne jegliche Konfiguration). Sobald du dein
> eigenes **Firebase**-Projekt einträgst, schalten sich Konten, XP/Level,
> Statistiken, Rangliste und Moderation frei.

---

## ✨ Features

- **3D-Echtzeit-Gameplay** (Three.js / react-three-fiber), Desktop **&** Mobile (Touch-Joystick)
- **Lobby & Matchmaking**: Schnelles Spiel, öffentliche Räume, private Räume mit Code/Passwort
- **Teams**: Hider vs. Seeker, automatische Zuteilung, Spielphasen (Verstecken → Jagd → Ende)
- **Tarn-Mechanik**: Farbe wechseln + Objektfarben kopieren (serverseitig validiert)
- **Accounts**: Registrierung, Login, Google, **Gastmodus** (alles via Firebase Auth)
- **Fortschritt**: XP, Level, Statistiken, **Rangliste** (serverautoritativ – nicht cheatbar)
- **Kosmetik**: Hider-Farben ausrüsten (Skins/Emotes als Grundgerüst angelegt)
- **Echtzeit-Chat** & Emotes
- **Sicherheit**: autoritativer Server, Firestore-Rules, Ban-/Report-Grundlage

---

## 🏗️ Architektur

```
            ┌──────────────────────────┐
            │   Client (Browser)       │
            │  React + Three.js (Vite) │
            └───────┬───────────┬──────┘
                    │ WebSocket │ HTTPS (SDK)
                    ▼           ▼
   ┌────────────────────┐   ┌─────────────────────────────┐
   │  Game-Server        │   │  Firebase                   │
   │  Colyseus (Node.js) │──▶│  Auth · Firestore · Storage │
   │  autoritativ, 20 Hz │   │  (Admin SDK schreibt XP)    │
   └────────────────────┘   └─────────────────────────────┘
        Render (free)              Firebase Spark (free)
```

- **Realtime-Gameplay** läuft über einen dedizierten **Colyseus**-Server (niedrige Latenz).
- **Persistente Daten** (Accounts, XP, Rangliste, Kosmetik) liegen in **Firebase**.
- Der Server verifiziert Firebase-ID-Tokens und schreibt XP/Stats per **Admin SDK**
  (Clients können das nicht – siehe `firebase/firestore.rules`).
- Kein Redis / kein extra Postgres nötig bei ~100 gleichzeitigen Spielern (eine Instanz).

### Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | TypeScript, React 18, Vite, Tailwind CSS, Zustand |
| 3D | Three.js, @react-three/fiber, @react-three/drei |
| Realtime | Colyseus + colyseus.js (WebSockets, @colyseus/schema) |
| Backend | Node.js, Colyseus, Express, firebase-admin |
| Daten | Firebase Auth, Cloud Firestore, Firebase Storage |
| Hosting | Render (Server), Vercel **oder** Firebase Hosting (Client) |

---

## 📁 Monorepo-Struktur

```
enzae-chameleon/
├── packages/
│   ├── shared/   # Geteilte Typen, Konstanten, Map-Generierung, Colyseus-Schema, Protokoll
│   ├── server/   # Colyseus Game-Server (Rooms, Auth, Spiel-Logik, Firebase-Admin)
│   └── client/   # React + Three.js Frontend
├── firebase/     # Firestore- & Storage-Sicherheitsregeln, Indizes
├── .github/      # CI (GitHub Actions)
├── render.yaml   # Render Deploy-Blueprint (Server)
├── vercel.json   # Vercel Deploy-Config (Client)
└── firebase.json # Firebase Hosting + Rules Deploy
```

---

## 🚀 Schnellstart (lokal, ohne Firebase)

Voraussetzungen: **Node.js ≥ 20** (empfohlen 22).

```bash
npm install
npm run dev
```

- Client: <http://localhost:5173>
- Server: <http://localhost:2567>

Auf „**Als Gast spielen**" klicken → „**Schnelles Spiel**". Öffne das Spiel in
**zwei** Browser-Tabs, um Multiplayer zu testen (mind. 2 Spieler pro Runde).

> `npm run dev` baut zuerst `shared` und startet dann Server + Client parallel.

### Steuerung

| Aktion | Desktop | Mobile |
|---|---|---|
| Bewegen | WASD / Pfeiltasten | Joystick (unten links) |
| Tarnen (Objektfarbe kopieren) | 🦎-Button | 🦎-Button |
| Farbe wählen | 🎨-Button | 🎨-Button |
| Markieren (Seeker) | Hider anklicken **oder** 🎯-Button | 🎯-Button |
| Emote / Chat | Buttons im HUD | Buttons im HUD |

---

## 🔥 Firebase einrichten (für Accounts, XP, Rangliste)

Optional, aber empfohlen. Free-Tier (**Spark**) genügt für ~100 Spieler.

1. **Projekt anlegen** auf <https://console.firebase.google.com> → „Projekt hinzufügen".
2. **Authentication** → „Erste Schritte" → aktiviere:
   - *E-Mail/Passwort*
   - *Anonym* (für den Gastmodus mit Persistenz)
   - *Google* (optional)
3. **Firestore Database** → „Datenbank erstellen" (Produktionsmodus, Region z. B. `eur3`).
4. **Storage** → aktivieren (für Profilbilder).
5. **Web-App registrieren** (Projektübersicht → `</>`-Symbol) und die Config kopieren.

### Client-Konfiguration

```bash
cp packages/client/.env.example packages/client/.env
```

Fülle in `packages/client/.env` die `VITE_FIREBASE_*`-Werte aus der Web-App-Config aus.

### Server-Konfiguration (Admin SDK)

Firebase Console → ⚙️ → *Dienstkonten* → **Neuen privaten Schlüssel generieren**
(lädt eine JSON-Datei). Dann:

```bash
cp packages/server/.env.example packages/server/.env
```

Trage die JSON als eine Zeile in `FIREBASE_SERVICE_ACCOUNT` ein **oder** nutze die
drei Felder `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`.

> ⚠️ Die Service-Account-JSON **niemals** committen – sie ist bereits in `.gitignore`.

### Sicherheitsregeln deployen

```bash
npm i -g firebase-tools
firebase login
firebase use --add        # dein Projekt auswählen
firebase deploy --only firestore:rules,storage
```

Oder den Inhalt von `firebase/firestore.rules` / `firebase/storage.rules` in der
Console unter *Rules* einfügen.

### Moderator/Admin ernennen

In Firestore das Dokument `users/<uid>` öffnen und das Feld `role` auf
`"moderator"` oder `"admin"` setzen (Clients dürfen das laut Rules nicht selbst).

---

## ☁️ Öffentlich spielbar machen (GitHub Pages + Render)

Ein Multiplayer-Spiel braucht **zwei** Online-Teile: den **Client** (statische
Seite, hier auf GitHub Pages) **und** den **Game-Server** (auf Render). Beide
kostenlos. **Reihenfolge ist wichtig** – erst der Server, dann der Client.

### Schritt 1 — Server auf Render

1. <https://render.com> → **New → Blueprint** → dieses Repo wählen (nutzt `render.yaml`).
2. Deploy abwarten. Du erhältst eine URL wie
   `https://enzae-chameleon-server.onrender.com`.
3. (Optional) Im Render-Dashboard das Secret `FIREBASE_SERVICE_ACCOUNT` setzen,
   um Accounts/XP zu aktivieren. `CORS_ORIGIN` kann auf `*` bleiben.

> ℹ️ Free-Plan schläft nach ~15 Min Inaktivität ein → erster Spieler ~30–60 s Kaltstart.

### Schritt 2 — Pages aktivieren

GitHub-Repo → **Settings → Pages → Source: „GitHub Actions"**.

### Schritt 3 — Server-URL als Repo-Variable hinterlegen

Repo → **Settings → Secrets and variables → Actions → Variables → New variable**:

| Variable | Wert |
|---|---|
| `VITE_SERVER_URL` | **`wss://`**`…onrender.com` (deine Render-URL, mit `wss://`!) |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | *(optional, für Accounts)* |

> Die Pages-Seite ist HTTPS → der Server muss **`wss://`** sein (nicht `ws://`),
> sonst blockt der Browser die Verbindung.

### Schritt 4 — Deploy auslösen

Der Workflow `.github/workflows/deploy-pages.yml` läuft bei jedem Push (oder
manuell unter **Actions → Deploy Client to GitHub Pages → Run workflow**).
Ergebnis-URL: **`https://<dein-user>.github.io/enzae-chameleon/`**

> Läuft der Deploy auf deinem `claude/…`-Branch nicht durch (Environment-Schutz),
> dann unter **Settings → Environments → github-pages** diesen Branch erlauben –
> oder den Branch nach `main` mergen.

> Nach jeder Änderung an `VITE_SERVER_URL` den Workflow **erneut** ausführen, da
> die URL beim Build fest eingebaut wird.

### Alternative Client-Hosts

- **Vercel:** Repo importieren (`vercel.json` wird genutzt), Env-Vars `VITE_SERVER_URL`
  + `VITE_FIREBASE_*` setzen. (Kein `BASE_PATH` nötig – Vercel served unter `/`.)
- **Firebase Hosting:** `VITE_SERVER_URL` in `packages/client/.env` setzen, dann
  `npm run build:shared && npm run build -w @enzae/client && firebase deploy --only hosting`.

---

## 🛠️ Skripte

| Befehl | Wirkung |
|---|---|
| `npm run dev` | Shared bauen, dann Server + Client im Watch-Modus |
| `npm run build` | Alles bauen (shared → server → client) inkl. Typecheck |
| `npm run typecheck` | Nur Typprüfung |
| `npm run start` | Gebauten Server starten (`dist/`) |

Einzelne Pakete: `npm run dev -w @enzae/client`, `npm run build -w @enzae/server`, …

---

## 🗺️ Roadmap (nächste Phasen)

Das aktuelle Gerüst enthält den vollständigen Spielkern. Als Nächstes geplant:

- [ ] Freundesliste-UI (Datenmodell & Rules liegen vor)
- [ ] Kosmetik-Shop mit Coins (Skins, Emotes) – Grundtypen vorhanden
- [ ] Admin-/Moderations-Dashboard (Reports, Bans) – Backend-Grundlage vorhanden
- [ ] Objekt-Kollision & Sichtlinien-Check fürs Markieren
- [ ] Mehr Maps & Spielmodi
- [ ] Redis-Presence + Multi-Instanz (für 1000+ Spieler)

---

## 📄 Lizenz

MIT
