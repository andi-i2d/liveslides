import { useState } from 'preact/hooks';
import { deleteDeck, loadDecks, newDeck, saveDeck, uid } from '../lib/store';
import { hasBackend } from '../lib/realtime';
import { setLang, t, useLang } from '../lib/i18n';
import { types } from '../slides';

/** Import: nur Decks akzeptieren, deren Folientypen wir kennen. */
export function validDeck(d: any): boolean {
  return (
    d && typeof d.title === 'string' && Array.isArray(d.slides) &&
    d.slides.every((s: any) => s && typeof s.type === 'string' && s.type in types && s.data && typeof s.data === 'object')
  );
}

export function Home() {
  const lang = useLang();
  const [decks, setDecks] = useState(loadDecks());
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const importDeck = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!validDeck(d)) throw new Error('invalid');
      d.id = uid();
      d.slides.forEach((s: any) => (s.id = uid()));
      saveDeck(d);
      setDecks(loadDecks());
      setErr('');
    } catch {
      setErr(t('home.badFile'));
    }
    input.value = '';
  };
  return (
    <div class="page">
      <div class="row">
        <h1 class="grow">LiveSlides</h1>
        <select
          class="langsel"
          aria-label={t('a11y.lang')}
          value={lang}
          onChange={(e) => setLang((e.target as HTMLSelectElement).value as 'de' | 'en')}
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>
      {!hasBackend && <p class="warn" role="note">{t('home.noBackend')}</p>}
      {err && <p class="warn" role="alert">{err}</p>}
      <section>
        <h3>{t('home.join')}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) location.hash = `#/join/${code.trim().toUpperCase()}`;
          }}
        >
          <input aria-label={t('home.code')} placeholder={t('home.code')} value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <button class="btn">{t('home.joinBtn')}</button>
        </form>
      </section>
      <section>
        <h3>{t('home.decks')}</h3>
        {decks.map((d) => (
          <div class="row-item">
            <b>{d.title}</b> <small>{d.slides.length} {t('home.slides')}</small>
            <span class="grow" />
            <a class="btn" href={`#/edit/${d.id}`}>{t('home.edit')}</a>
            <a class="btn primary" href={`#/present/${d.id}`}>{t('home.present')}</a>
            <button
              class="btn"
              aria-label={`${t('a11y.delete')}: ${d.title}`}
              onClick={() => {
                if (confirm(t('home.confirmDelete'))) {
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
          {t('home.new')}
        </button>{' '}
        <label class="btn">
          {t('home.import')}
          <input type="file" accept="application/json" hidden onChange={importDeck} />
        </label>
      </section>
    </div>
  );
}
