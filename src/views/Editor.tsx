import { useEffect, useRef, useState } from 'preact/hooks';
import type { Deck, Field } from '../lib/types';
import { getDeck, saveDeck } from '../lib/store';
import { createSlide, typeList, types } from '../slides';
import { t as tr, useLang } from '../lib/i18n';
import { cloudReady, cloudSaveDeck, useCloudStatus } from '../lib/cloud';
import { nameMode, type NameMode } from '../lib/names';

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  if (f.kind === 'textarea')
    return <textarea value={value} onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)} />;
  if (f.kind === 'select')
    return (
      <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {f.options?.map((o) => (
          <option value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  if (f.kind === 'number')
    return <input type="number" value={value} onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} />;
  if (f.kind === 'list')
    return (
      <textarea
        placeholder="Eine Zeile pro Eintrag"
        value={(value as string[]).join('\n')}
        onInput={(e) => onChange((e.target as HTMLTextAreaElement).value.split('\n'))}
      />
    );
  return <input value={value} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />;
}

export function Editor({ id }: { id: string }) {
  const [deck, setDeck] = useState<Deck | undefined>(getDeck(id));
  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (deck) saveDeck(deck);
  }, [deck]);
  useLang();
  const cloud = useCloudStatus();
  // Änderungen nach kurzer Pause in Google Drive sichern (nicht beim bloßen Öffnen)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!deck || !cloudReady()) return;
    const timer = setTimeout(() => cloudSaveDeck(deck), 2000);
    return () => clearTimeout(timer);
  }, [deck]);
  if (!deck) return <div class="page">{tr('editor.notFound')} <a href="#/">{tr('editor.back')}</a></div>;
  const slide = deck.slides[Math.min(sel, deck.slides.length - 1)];
  const t = slide && types[slide.type];
  const update = (fn: (d: Deck) => void) => {
    const c = structuredClone(deck);
    fn(c);
    setDeck(c);
  };
  const categories = [...new Set(typeList.map((x) => x.category))];

  return (
    <div class="editor">
      <aside class="slides">
        <a href="#/">{tr('editor.back')}</a>
        {deck.slides.map((s, i) => (
          <button class={'thumb' + (i === sel ? ' on' : '')} aria-current={i === sel} onClick={() => setSel(i)}>
            {i + 1}. {types[s.type].icon} {types[s.type].label}
          </button>
        ))}
        <select
          aria-label={tr('editor.add')}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            if (!v) return;
            update((d) => d.slides.push(createSlide(v)));
            setSel(deck.slides.length);
            (e.target as HTMLSelectElement).value = '';
          }}
        >
          <option value="">{tr('editor.add')}</option>
          {categories.map((c) => (
            <optgroup label={c}>
              {typeList
                .filter((x) => x.category === c)
                .map((x) => (
                  <option value={x.id}>
                    {x.icon} {x.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </aside>

      <main class="canvas">
        {slide && t && (
          <div class="stage small">
            <t.Stage data={slide.data} ctx={{ responses: [], all: {}, deck, joinUrl: location.href, code: 'ABCDE', reveal: true, step: 0, next: () => {} }} />
          </div>
        )}
      </main>

      <aside class="props">
        <label>
          {tr('editor.deckTitle')}
          <input value={deck.title} onInput={(e) => update((d) => (d.title = (e.target as HTMLInputElement).value))} />
        </label>
        <label>
          {tr('editor.names')}
          <select
            value={nameMode(deck)}
            onChange={(e) => update((d) => (d.settings = { ...d.settings, names: (e.target as HTMLSelectElement).value as NameMode }))}
          >
            <option value="required">{tr('editor.names.required')}</option>
            <option value="optional">{tr('editor.names.optional')}</option>
          </select>
        </label>
        {slide && t && (
          <>
            <h4>{t.icon} {t.label}</h4>
            {t.fields.map((f) => (
              <label>
                {f.label}
                <FieldInput
                  f={f}
                  value={slide.data[f.key]}
                  onChange={(v) => update((d) => (d.slides[sel].data[f.key] = v))}
                />
              </label>
            ))}
            <div class="row">
              <button class="btn" disabled={sel === 0} onClick={() => { update((d) => d.slides.splice(sel - 1, 0, d.slides.splice(sel, 1)[0])); setSel(sel - 1); }}>↑</button>
              <button class="btn" disabled={sel >= deck.slides.length - 1} onClick={() => { update((d) => d.slides.splice(sel + 1, 0, d.slides.splice(sel, 1)[0])); setSel(sel + 1); }}>↓</button>
              <button class="btn" onClick={() => { update((d) => d.slides.splice(sel + 1, 0, { ...structuredClone(d.slides[sel]), id: Math.random().toString(36).slice(2, 10) })); setSel(sel + 1); }}>⧉</button>
              <button class="btn" disabled={deck.slides.length < 2} onClick={() => { update((d) => d.slides.splice(sel, 1)); setSel(Math.max(0, sel - 1)); }}>🗑</button>
            </div>
          </>
        )}
        {cloudReady() && (
          <div class="cloudline" role="status">
            {cloud.state === 'saving' ? tr('cloud.saving') : cloud.state === 'saved' ? tr('cloud.saved') : cloud.state === 'error' ? `${tr('cloud.error')}: ${cloud.message}` : ''}
            <button class="btn" onClick={() => cloudSaveDeck(deck)}>{tr('cloud.saveNow')}</button>
          </div>
        )}
        <a class="btn primary" href={`#/present/${deck.id}`}>{tr('editor.present')}</a>
        <button
          class="btn"
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' }));
            a.download = `${deck.title}.json`;
            a.click();
          }}
        >
          {tr('editor.export')}
        </button>
      </aside>
    </div>
  );
}
