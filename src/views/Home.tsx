import { useState } from 'preact/hooks';
import { deleteDeck, loadDecks, newDeck, saveDeck, uid } from '../lib/store';
import { hasBackend } from '../lib/realtime';
import { setLang, t, useLang } from '../lib/i18n';
import { types } from '../slides';
import { Banner } from './Brand';
import { useAuth } from '../lib/google';
import { cloudListDecks, cloudLoadDeck } from '../lib/cloud';
import type { DriveFile } from '../lib/drive';

/** Import: nur Decks akzeptieren, deren Folientypen wir kennen. */
export function validDeck(d: any): boolean {
  return (
    d && typeof d.title === 'string' && Array.isArray(d.slides) &&
    d.slides.every((s: any) => s && typeof s.type === 'string' && s.type in types && s.data && typeof s.data === 'object')
  );
}

function DriveImport({ onImported }: { onImported: () => void }) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const open = async () => {
    setBusy(true);
    setErr('');
    try {
      setFiles(await cloudListDecks());
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
    setBusy(false);
  };
  const imp = async (f: DriveFile) => {
    try {
      const d = await cloudLoadDeck(f.id);
      if (!validDeck(d)) throw new Error(t('home.badFile'));
      d.id = uid();
      d.slides.forEach((s) => (s.id = uid()));
      saveDeck(d);
      onImported();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };
  return (
    <section>
      <button class="btn" disabled={busy} onClick={open}>{busy ? t('cloud.loading') : t('cloud.load')}</button>
      {err && <p class="warn" role="alert">{err}</p>}
      {files && files.length === 0 && <p class="hint">{t('cloud.empty')}</p>}
      {files?.map((f) => (
        <div class="row-item">
          <span>{f.name.replace(/\.json$/, '')}</span>
          <small class="hint">{new Date(f.modifiedTime).toLocaleString()}</small>
          <span class="grow" />
          <button class="btn" onClick={() => imp(f)}>{t('cloud.import')}</button>
        </div>
      ))}
    </section>
  );
}

export function Home() {
  const lang = useLang();
  const auth = useAuth();
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
      <Banner />
      <div class="row head">
        <h1 class="brand grow"><b>L</b>ive<b>S</b>lides</h1>
        {auth.user && (
          <span class="userchip">
            {auth.user.picture && <img src={auth.user.picture} alt="" referrerpolicy="no-referrer" />}
            <span>{auth.user.email}</span>
            <button class="btn" onClick={() => auth.signOut()}>{t('auth.signout')}</button>
          </span>
        )}
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
      {auth.user && <DriveImport onImported={() => setDecks(loadDecks())} />}
    </div>
  );
}
