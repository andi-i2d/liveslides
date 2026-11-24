# LiveSlides

Interaktive Präsentationen im Stil von AhaSlides, statisch auf GitHub Pages gehostet
(https://andi-i2d.github.io/liveslides/). Stack: Vite + TypeScript + Preact.
Live-Teilnahme per Handy über Supabase Realtime (Broadcast), 63 Folientypen.

## Entwickeln
```
npm install
npm run dev      # http://localhost:5173
npm test         # Unit-Tests (Vitest)
npm run e2e      # End-to-End (Playwright; lokal mit installiertem Edge; Google/Drive werden simuliert)
npm run build
```
Ohne Supabase läuft ein Testmodus (BroadcastChannel): Präsentator-Tab und Teilnehmer-Tab im **selben Browser**. **Taste Q** blendet jederzeit einen großen QR-Code zum Beitreten ein.

## Supabase einrichten (für echte Handys)
1. Kostenloses Projekt auf supabase.com anlegen. Keine Tabellen nötig – es wird nur *Realtime Broadcast* genutzt.
2. Lokal: `.env.local` mit `VITE_SUPABASE_URL=…` und `VITE_SUPABASE_ANON_KEY=…`.
3. GitHub: Repo → Settings → Secrets and variables → Actions → *Variables*: dieselben zwei Werte anlegen.
   Der anon-Key ist öffentlich vorgesehen. Der Präsentator-Browser hält alle Antworten im Speicher
   (Neuladen verwirft sie) und verwirft Fluten und überlange Nachrichten (`src/lib/guard.ts`).

## Bedienung
- Präsentieren: Pfeiltasten/Leertaste blättern, **R** löst Quizfragen auf, **N** schaltet Etappen weiter
  (Turnier, Team-Retro), **F** Vollbild. Teilnehmer treten über QR-Code oder Code bei.
- Decks liegen im Browser (localStorage). Über JSON exportieren/importieren, um sie zu sichern oder zu teilen.
- Sprache der Oberfläche: Deutsch/Englisch (Auswahl auf der Startseite). Folieninhalte sind frei wählbar.
- Offline: Nach dem ersten Laden funktionieren Editor und Präsentation ohne Netz (Service Worker);
  Live-Teilnahme braucht Verbindung.

## Google-Anmeldung und Drive (optional)
Ist `VITE_GOOGLE_CLIENT_ID` gesetzt, müssen sich Organisatoren (Startseite, Editor, Präsentator) mit Google anmelden.
Teilnehmer (`#/join/…`) brauchen **keine** Anmeldung. Angemeldete Nutzer bekommen:
- **Decks in Drive:** Änderungen im Editor werden automatisch als `LiveSlides/Präsentationen/<Titel>.json` gesichert;
  auf der Startseite lassen sie sich aus Drive wieder laden.
- **Ergebnisse in Drive:** Während der Präsentation (5 s nach der letzten Antwort, bei Folienwechsel, beim Verlassen und
  per ☁-Knopf) entsteht `LiveSlides/Ergebnisse/<Datum> <Titel> – Ergebnisse (<Code>).json` mit allen Antworten je Folie,
  Namen, Zeitstempeln und der Rangliste.
- Optional `VITE_ALLOWED_DOMAIN` (z. B. `i2d.de`): Konten anderer Domains werden abgelehnt.
- Optional `VITE_DRIVE_FOLDER_ID`: fester Zielordner (z. B. im geteilten Laufwerk). Dafür wird der volle Drive-Zugriff
  angefordert; ohne diese Variable genügt `drive.file` (die App sieht nur Dateien, die sie selbst angelegt hat).

**Einrichtung in der Google Cloud Console** (am besten mit einem Konto der Organisation):
1. Projekt anlegen und unter *APIs & Dienste → Bibliothek* die **Google Drive API** aktivieren.
2. *Google Auth Platform / OAuth-Zustimmungsbildschirm*: Nutzertyp **Intern** (nur Workspace-Konten der Organisation, keine
   Verifizierung nötig). Bereiche: `openid`, `email`, `profile`, `…/auth/drive.file` (mit Ordner-ID stattdessen `…/auth/drive`).
3. *Clients → OAuth-Client erstellen* → Typ **Webanwendung**. Autorisierte JavaScript-Quellen:
   `https://andi-i2d.github.io` und `http://localhost:5173`. Weiterleitungs-URIs sind nicht nötig. Die **Client-ID** kopieren
   (es gibt kein Secret, das in die App gehört).
4. Client-ID (und Domain) als GitHub-Variablen bzw. in `.env.local` eintragen (siehe `.env.example`), dann neu deployen.

**Wichtig zu wissen**
- Die Anmeldung steuert, wer Drive anbinden kann, ist aber bei einer statischen Seite **keine Zugriffssperre im Sicherheitssinn**:
  Die App-Dateien sind öffentlich, und Decks liegen ohnehin lokal im Browser.
- Zugriffstokens laufen nach ca. 1 Stunde ab und werden still erneuert. Blockiert der Browser Drittanbieter-Cookies, kann dafür
  eine erneute Anmeldung nötig sein; das ☁-Symbol zeigt dann einen Fehler.
- Die Ergebnisdateien enthalten die Namen der Teilnehmer. Datenschutz (Information der Teilnehmer, Aufbewahrung) liegt bei euch.
## Folientypen (63)
- **Inhalt:** Titel, Inhalt (Bild links/rechts), Liste, Zitat, Bild, YouTube, Diagramm (Schritte, Zeitleiste, Zyklus, Hierarchie), Vergleich, SWOT, Chart (Säulen, Linie, Kreis, Ring), QR-Code
- **Umfrage:** Umfrage, Emoji, Wahr/Falsch, Wortwolke, Offene Frage, Skala, Ranking, Zuordnung, 2×2-Matrix, Radar, Punkte verteilen, Ideenwand, Brainstorming, Kurzumfrage, Q&A
- **Quiz:** Auswahl, Kurzantwort, Wahr/Falsch, Zahl schätzen, Reihenfolge, Kategorien, Paare, Lückentext, fehlende Buchstaben, Kreuzworträtsel, YouTube-Quiz, Pin auf Bild, Pin auf Karte, Bild erraten, Pick-a-Boo, Bubble Rush, Schatzsuche, Rangliste
- **Bild:** Pin auf Bild, Interaktives Bild, Auf Bild zeichnen, Antwort zeichnen, Foto teilen
- **Spiele & Werkzeuge:** Glücksrad, Timer, Atempause, Gruppen, Paare, Entenrennen, Halloween-Rennen, Turnier, Team-Retro, Mindmap, Persönlichkeitstest, Rückblick, Escape Room, Kopf-Tausch

## Neuen Folientyp hinzufügen
Eintrag vom Typ `SlideType` (`src/lib/types.ts`) anlegen und in `src/slides/index.ts` registrieren
(`defaults`, `fields`, `Stage` fürs Beamerbild, optional `Player` fürs Handy, `score`, `live`, `steps`).
Bewertungslogik gehört als reine Funktion nach `src/slides/grading.ts` bzw. `gamelogic.ts` (mit Test).

## Deploy
Repo `liveslides` auf GitHub, Settings → Pages → Source: **GitHub Actions**. Push auf `main` führt Tests und E2E aus und deployt.

## Bekannte Grenzen
- Keine Konten oder Server-Speicherung: Ergebnisse gehen verloren, wenn der Präsentator-Tab geschlossen wird.
- Der Teilnehmer-Name und die Geräte-ID liegen im Browser; zwei Tabs im selben Browser zählen als eine Person.
- Bilder und Karten werden per URL eingebunden (kein Upload). Foto- und Zeichen-Antworten werden verkleinert.
- Das Kreuzworträtsel ist eine Hinweis/Lösungs-Liste ohne Gitter; Quiz-Punkte hängen nicht von der Antwortzeit ab.