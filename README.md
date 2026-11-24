# LiveSlides

AhaSlides-ähnliche interaktive Präsentationen, statisch auf GitHub Pages gehostet.
Stack: Vite + TypeScript + Preact. Live-Teilnahme über Supabase Realtime (Broadcast).

## Entwickeln
```
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```
Ohne Supabase läuft ein Testmodus (BroadcastChannel): Präsentator-Tab und Teilnehmer-Tab im **selben Browser**.

## Supabase einrichten (für echte Handys)
1. Kostenloses Projekt auf supabase.com anlegen. Keine Tabellen nötig – es wird nur *Realtime Broadcast* genutzt.
2. Lokal: `.env.local` mit `VITE_SUPABASE_URL=…` und `VITE_SUPABASE_ANON_KEY=…`.
3. GitHub: Repo → Settings → Secrets and variables → Actions → *Variables*: dieselben zwei Werte anlegen.

## Deploy
Repo `liveslides` auf GitHub, Settings → Pages → Source: **GitHub Actions**. Push auf `main` deployt.

## Neuen Folientyp hinzufügen
Eintrag vom Typ `SlideType` (`src/lib/types.ts`) anlegen und in `src/slides/index.ts` registrieren
(`defaults`, `fields`, `Stage` fürs Beamerbild, optional `Player` fürs Handy und `score`).

## Stand
Phase 1-5 fertig (46 Folientypen): Inhalt, Diagramme, Charts, Q&A, 14 Umfragetypen, 11 Quiztypen sowie Bild/Karte/Zeichnen (Pin auf Bild, Pin-Quiz, Karten-Quiz, Interaktives Bild, Auf Bild zeichnen, Antwort zeichnen, Foto teilen, Bild erraten).
Quiz-Loesungen erscheinen erst nach Klick auf 'Aufloesen' (Taste R).
Offen: Phase 6 (Spiele), 7 (Politur).
