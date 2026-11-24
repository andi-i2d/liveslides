import { useState } from 'preact/hooks';
import type { SlideType } from '../lib/types';
import { ideasWithVotes, merge } from './ideas';

/** Live-Q&A: Fragen einreichen, per 👍 hochwählen. Meistgewählte zuerst. */
export const qa: SlideType = {
  id: 'qa',
  label: 'Q&A',
  icon: '🙋',
  category: 'Umfrage',
  interactive: true,
  multi: true,
  live: true,
  defaults: () => ({ title: 'Eure Fragen' }),
  fields: [{ key: 'title', label: 'Titel', kind: 'text' }],
  Stage: ({ data, ctx }) => {
    const list = ideasWithVotes(ctx.responses);
    return (
      <div class="col">
        <h2>{data.title}</h2>
        {list.length === 0 && <p class="sub">Noch keine Fragen – reicht eure per Handy ein.</p>}
        <div class="cards">
          {list.map((q) => (
            <div class="card">
              {q.text}
              <small class="hint"> — {q.name} · 👍 {q.votes}</small>
            </div>
          ))}
        </div>
      </div>
    );
  },
  Player: ({ data, submit, mine, live, pid }) => {
    const [v, setV] = useState('');
    const all = merge(live, mine);
    const list = ideasWithVotes(all);
    const voted = new Set(all.filter((r) => r.pid === pid && (r.data as any)?.up).map((r) => (r.data as any).up as string));
    return (
      <>
        <h3>{data.title}</h3>
        <textarea value={v} placeholder="Deine Frage …" maxLength={300} onInput={(e) => setV((e.target as HTMLTextAreaElement).value)} />
        <button
          class="btn primary"
          onClick={() => {
            if (v.trim()) {
              submit(v.trim());
              setV('');
            }
          }}
        >
          Frage senden
        </button>
        {list.map((q) => (
          <div class="rank">
            <span class="grow">{q.text}</span>
            <button class="btn" disabled={voted.has(q.key)} onClick={() => submit({ up: q.key })}>👍 {q.votes}</button>
          </div>
        ))}
      </>
    );
  },
};
