# LiveSlides

Interaktive Präsentationen im Stil von AhaSlides, statisch auf GitHub Pages gehostet
(https://andi-i2d.github.io/liveslides/). Stack: Vite + TypeScript + Preact.
Live-Teilnahme per Handy über Supabase Realtime (Broadcast), 63 Folientypen.

Design: angelehnt an www.i2d.info (heller Grund, Schrift Lato, Akzent Orange #fc6933). Farben stehen als CSS-Variablen in src/styles.css, die Diagrammfarben in den Paletten der Folien (src/slides/*.tsx). Die Schrift ist selbst gehostet (@fontsource/lato), es gibt keine Anfragen an Google Fonts. Logo und Briefkopf-Banner von Innovation2Didactics liegen in src/assets/ (i2d-logo.svg aus dem bereitgestellten SVG von Inkscape-Metadaten bereinigt, i2d-banner.jpg aus dem Briefkopf auf 1800 px verkleinert, 95 KB) und werden in src/views/Brand.tsx verwendet; das Favicon ist public/favicon.svg.

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
- **Namen der Teilnehmer:** Beim Beitritt steht im Namensfeld ein lustiger Vorschlag aus dem Ideen-/Denk-/Innovationsbereich, z. B. „Dreister Denker“ oder „Lustiger Luchs“ (Adjektiv und Nomen mit gleichem Anfangsbuchstaben, 699 Namen, pro Gerät stabil). Wer will, tippt einen eigenen Namen oder würfelt mit 🎲 einen anderen Vorschlag; ein leeres Feld ergibt wieder den Vorschlag, der Name ist also nie leer. Bis 699 Personen vergibt der Präsentator jeden Listennamen höchstens einmal (ohne Nummern); selbst getippte gleiche Namen werden zu „Anna“, „Anna 2“. Das Handy zeigt oben „👤 Name“. Die Wortliste steht in `src/lib/namewords.ts`; ein Test prüft Buchstaben, Länge und eine Liste unerwünschter Wörter.
- **Folienauswahl:** „+ Folie hinzufügen …“ öffnet ein Fenster mit zwei Reitern: **Präsentierend** (zeigt Inhalte, keine Eingaben vom Publikum: Inhalt, Diagramme, Charts, Rangliste, Werkzeuge wie Glücksrad und Timer) und **Interaktiv** (das Publikum macht per Handy mit: Umfragen, Quiz, Bilder, Spiele), darunter nach Gruppen sortiert. Interaktive Folien tragen in der Folienliste ein ⚡.
- **Teilnehmeransicht (Vorschau) im Editor:** „📱 Teilnehmeransicht“ zeigt die echte Handy-Ansicht der gewählten Folie in einem Handy-Rahmen. Eingaben bleiben lokal („Zurücksetzen“ setzt die Vorschau neu auf), es wird nichts gesendet oder gezählt.
- **Foto teilen (Folientyp „Foto teilen (landet in Drive)“):** Teilnehmende senden Fotos in guter Qualität (bis 180 KB, ca. 1280 px, bis zu so vielen je Person, wie in der Folie eingestellt). Der Präsentator-Browser legt jedes Foto **automatisch** im Unterordner `Fotos` der Präsentation in Drive ab, im selben Ordner wie die Präsentation und ihre Ergebnisdateien. Der Dateiname enthält den **Einsendernamen**: `<Datum> <Uhrzeit> <Einsendername> <Nr>.jpg`, z. B. `2026-11-25 10.30.05 Lustiger Luchs 3.jpg` (bei einem selbst getippten Namen dieser Name; unzulässige Zeichen werden durch „-“ ersetzt). Voraussetzung: Der Präsentator ist angemeldet und lässt seinen Browser-Tab offen; sonst zeigt die Folie eine Warnung und die Fotos erscheinen nur auf dem Beamer. Fehlgeschlagene Uploads werden bis zu dreimal erneut versucht, auch per ☁-Knopf. Optional zeigt der Beamer eine Galerie oder nur einen Zähler. Auf dem Handy steht ein Hinweis, dass das Foto gezeigt und gespeichert wird (Datenschutz: Teilnehmende bitte zusätzlich informieren). Der frühere Folientyp „Foto-Drop“ (`photodrop`) ist zu „Foto teilen“ zusammengelegt; bestehende Folien laufen weiter. In den Ergebnisdateien stehen Fotos und Zeichnungen nur als Hinweis, nicht als Bilddaten.
- **Bilder:** Jedes Bildfeld im Editor nimmt eine **URL**, eine **Datei vom Rechner** („Vom Rechner …“) oder (nach Google-Anmeldung) ein **Bild aus Drive** („Aus Drive …“, Suche über alle Laufwerke inkl. geteilter; dafür ist der volle Drive-Zugriff nötig, siehe unten). Dateien werden im Browser auf höchstens 180 KB verkleinert (JPEG) und direkt in die Präsentation eingebettet; sie sind damit auch Teil des JSON-Exports und der Drive-Sicherung. Auf die Handys wird das Deck ohne eingebettete Bilder gesendet; Bilder, die ein Handy anzeigt (Pin auf Bild, Pin-Quizze, Interaktives Bild, Auf Bild zeichnen), kommen als eigene kleine Nachricht je Folie (unter dem 256-KB-Limit von Supabase Free), spät Beitretende erhalten sie mit der Antwort auf „Hallo“. In den Ergebnisdateien stehen Bilder nur als Hinweis. Der Browser-Speicher (ca. 5 MB) fasst grob 25 eingebettete Bilder pro Gerät; ist er voll, warnt der Editor.
- Decks liegen im Browser (localStorage). Über JSON exportieren/importieren, um sie zu sichern oder zu teilen.
- Sprache der Oberfläche: Deutsch/Englisch (Auswahl auf der Startseite). Folieninhalte sind frei wählbar.
- Offline: Nach dem ersten Laden funktionieren Editor und Präsentation ohne Netz (Service Worker);
  Live-Teilnahme braucht Verbindung.

## Google-Anmeldung und Drive (optional)
Status: Auf der Live-Seite aktiv für Konten @i2d.info (GitHub-Variablen VITE_GOOGLE_CLIENT_ID und VITE_ALLOWED_DOMAIN). Die Client-ID ist öffentlich; das heruntergeladene Client-Secret (client_secret_*.json) wird von der App nicht gebraucht und ist per .gitignore ausgeschlossen. Bitte außerhalb des Projektordners aufbewahren.

Ist `VITE_GOOGLE_CLIENT_ID` gesetzt, müssen sich Organisatoren (Startseite, Editor, Präsentator) mit Google anmelden.
Teilnehmer (`#/join/…`) brauchen **keine** Anmeldung. Angemeldete Nutzer bekommen:
- **Ablage in Drive:** Im Wurzelordner (`VITE_DRIVE_FOLDER_ID`, hier der geteilte i2d-Ordner) entsteht **je Präsentation ein Unterordner** mit dem Titel der Präsentation. Darin liegen die Präsentation (`<Titel>.json`, wird bei jeder Änderung im Editor überschrieben) und je Durchlauf eine Ergebnisdatei (`<Datum> <Uhrzeit> Ergebnisse (<Code>).json` mit allen Antworten je Folie, Namen, Zeitstempeln und Rangliste; gesichert 5 s nach der letzten Antwort, bei Folienwechsel, beim Verlassen und per ☁-Knopf). Ohne Ordner-ID wird stattdessen „LiveSlides“ im eigenen Drive als Wurzel angelegt. Der Ordner wird über die Präsentations-ID gefunden und bei Titeländerung umbenannt; zwei Präsentationen mit gleichem Titel bekommen getrennte Ordner. Auf der Startseite lassen sich Präsentationen aus Drive wieder laden.
- **Bilder aus Drive mit Google-Dateiwähler:** Ist `VITE_GOOGLE_API_KEY` gesetzt, öffnet „Aus Drive …“ den Standard-Dateiwähler von Google (Picker) mit Vorschaubildern, „Meine Ablage“, geteilten Laufwerken und „Mit mir geteilt“. Das Google-Skript wird erst beim Öffnen geladen. Ohne Schlüssel gibt es eine einfache Liste mit Namenssuche (ohne Vorschau). Einrichtung: Cloud Console → *APIs & Dienste → Bibliothek* → **Google Picker API** aktivieren; *Anmeldedaten → Anmeldedaten erstellen → API-Schlüssel*; beim Schlüssel *Anwendungseinschränkungen: Websites* mit `https://andi-i2d.github.io/*` (und `http://localhost:5173/*`) und *API-Einschränkungen: Google Picker API* setzen. Der Schlüssel steckt im Browser-Code, ist also öffentlich; die Einschränkung auf die Website schützt ihn vor Missbrauch. Als GitHub-Variable `VITE_GOOGLE_API_KEY` eintragen und neu deployen.
- **Bilder aus Google Fotos:** „Aus Google Fotos …“ nutzt die Google Photos Picker API: Die App legt eine Sitzung an, öffnet das Google-Fotos-Fenster zur Auswahl (genau ein Foto, das Fenster schließt sich danach selbst), fragt im vorgegebenen Takt ab, lädt das Foto, löscht die Sitzung und bettet das verkleinerte Bild ein. Der Zugriffsbereich `photospicker.mediaitems.readonly` wird **erst bei der ersten Nutzung** getrennt vom Login angefordert (Einwilligungsfenster); wer die Funktion nicht nutzt, muss nichts neu bestätigen. In der Cloud Console muss die **Google Photos Picker API** aktiviert sein; ein API-Schlüssel ist dafür nicht nötig. Bekannte Unsicherheit: Der Foto-Abruf braucht laut Google-Doku das Zugriffstoken im Header; ob der Bild-Server das aus dem Browser erlaubt (CORS), ist nicht dokumentiert. Scheitert er, erscheint die Meldung, das Foto herunterzuladen und über „Vom Rechner …“ zu wählen. In Google-Workspace-Konten ist Google Fotos teils nicht freigeschaltet.
- Optional `VITE_ALLOWED_DOMAIN` (z. B. `i2d.de`): Konten anderer Domains werden abgelehnt.
- `VITE_DRIVE_FOLDER_ID`: ID des Wurzelordners (der Teil hinter `/folders/` in der Drive-URL). Dafür wird der **volle Drive-Zugriff** (`…/auth/drive`) angefordert, auch dieser Bereich muss in der Google Auth Platform unter *Datenzugriff* eingetragen sein; das Konto braucht im Ordner mindestens die Rolle „Mitwirkender“. Ohne diese Variable genügt `drive.file` (die App sieht nur Dateien, die sie selbst angelegt hat).

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
- **Bild:** Pin auf Bild, Interaktives Bild, Auf Bild zeichnen, Antwort zeichnen, Foto teilen (landet in Drive)
- **Spiele & Werkzeuge:** Glücksrad, Timer, Atempause, Gruppen, Paare, Entenrennen, Halloween-Rennen, Turnier, Team-Retro, Mindmap, Persönlichkeitstest, Rückblick, Escape Room, Kopf-Tausch

## Neuen Folientyp hinzufügen
Eintrag vom Typ `SlideType` (`src/lib/types.ts`) anlegen und in `src/slides/index.ts` registrieren
(`defaults`, `fields`, `Stage` fürs Beamerbild, optional `Player` fürs Handy, `score`, `live`, `steps`).
Bewertungslogik gehört als reine Funktion nach `src/slides/grading.ts` bzw. `gamelogic.ts` (mit Test).

## Deploy
Repo `liveslides` auf GitHub, Settings → Pages → Source: **GitHub Actions**. Push auf `main` führt Tests und E2E aus und deployt.

## Größe und Grenzen (geplant: bis 699 Teilnehmende)
Grundsatz: Der Präsentator soll möglichst wenig tun und möglichst wenig auf Teilnehmer-Nachrichten reagieren müssen.
Deshalb: Namen werden automatisch vergeben, Ergebnisse automatisch in Drive gesichert, und der Funkverkehr ist sparsam:
- Beitritts-Ansturm: Viele gleichzeitige „Hallo“ werden zu **einer** Antwort mit dem Deck gebündelt (bei bis zu 20 Personen fast sofort, darüber im Sekundentakt). Handys wiederholen ihre Anfrage mit wachsenden Abständen (2 s bis ca. 15 s, mit Streuung).
- Folienwechsel senden nur Folien-Nummer und Schritt, nicht das ganze Deck erneut.
- Die „live“-Spiegelung (Ideenabstimmung, Q&A) wird mit der Teilnehmerzahl seltener getaktet (0,3 s bis 3 s).
- Pro Person höchstens 8 Nachrichten/s und 200 Antworten je Folie; überlange Nachrichten werden verworfen.

**Supabase-Plan:** Laut [Supabase-Doku](https://supabase.com/docs/guides/realtime/limits) erlaubt der Free-Plan 200 gleichzeitige Verbindungen und 100 Nachrichten/s,
Pro 500 Verbindungen und 500 Nachrichten/s, Pro ohne Spend-Cap bzw. Team 10.000 Verbindungen und 2.500 Nachrichten/s.
Für 699 Teilnehmende plus Präsentator (700 Verbindungen) braucht ihr also mindestens Pro **ohne Spend-Cap** (zusätzliche Spitzenverbindungen kosten extra).
Auch das Monatskontingent (Pro: 5 Mio. Nachrichten) ist im Blick zu behalten; ob jede Zustellung an einen Empfänger zählt, bitte vor dem Einsatz in der Doku/im Dashboard prüfen.

**Nicht getestet:** Die Software ist mit simulierten Lasten (Namensvergabe für 699 Geräte, Bündelung von 699 Hallos) und mit einzelnen echten Browsern geprüft, **nicht** mit 699 echten Geräten.
Vor dem Großeinsatz bitte einen Probelauf mit vielen Handys machen. Der Präsentator-Browser ist der zentrale Empfänger: ein stabiler Rechner mit guter Verbindung, andere Tabs schließen.
## Bekannte Grenzen
- Keine Konten oder Server-Speicherung: Ergebnisse gehen verloren, wenn der Präsentator-Tab geschlossen wird.
- Der Teilnehmer-Name und die Geräte-ID liegen im Browser; zwei Tabs im selben Browser zählen als eine Person.
- Eingebettete Bilder belegen Browser-Speicher (ca. 5 MB je Gerät). Die Weltkarte des Karten-Quiz ist standardmäßig eine URL (Wikimedia). Foto- und Zeichen-Antworten der Teilnehmer werden verkleinert.
- Das Kreuzworträtsel ist eine Hinweis/Lösungs-Liste ohne Gitter; Quiz-Punkte hängen nicht von der Antwortzeit ab.