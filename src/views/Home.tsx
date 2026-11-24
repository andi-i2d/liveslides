import { useState } from 'preact/hooks';
import { deleteDeck, loadDecks, newDeck, saveDeck, uid } from '../lib/store';
import { hasBackend } from '../lib/realtime';

export function Home() {
  const [decks, setDecks] = useState(loadDecks());
  const [code, setCode] = useState('');
  const importDeck = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const d = JSON.parse(await f.text());
    d.id = uid();
    saveDeck(d);
    setDecks(loadDecks());
  };
  return (
    <div class="page">
      <h1>LiveSlides</h1>
      {!hasBackend && (
        <p class="warn">
          Kein Supabase konfiguriert – Live-Teilnahme nur im selben Browser (Testmodus). Siehe README.
        </p>
      )}
      <section>
        <h3>Mitmachen</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            location.hash = `#/join/${code.trim().toUpperCase()}`;
          }}
        >
          <input placeholder="Code, z. B. K4M9P" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <button class="btn">Beitreten</button>
        </form>
      </section>
      <section>
        <h3>Meine Präsentationen</h3>
        {decks.map((d) => (
          <div class="row-item">
            <b>{d.title}</b> <small>{d.slides.length} Folien</small>
            <span class="grow" />
            <a class="btn" href={`#/edit/${d.id}`}>Bearbeiten</a>
            <a class="btn primary" href={`#/present/${d.id}`}>Präsentieren</a>
            <button
              class="btn"
              onClick={() => {
                if (confirm('Löschen?')) {
                  deleteDeck(d.id);
                  setDecks(loadDecks());
                }
              }}
            >
              🗑
            </button>
          </div>
        ))}
        <button
          class="btn primary"
          onClick={() => {
            const d = newDeck();
            location.hash = `#/edit/${d.id}`;
          }}
        >
          + Neue Präsentation
        </button>{' '}
        <label class="btn">
          Importieren (JSON)
          <input type="file" accept="application/json" hidden onChange={importDeck} />
        </label>
      </section>
    </div>
  );
}
