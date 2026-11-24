import type { Deck, Resp, SlideType } from '../lib/types';
import { Bars, Choice, tally } from './interactive';

/** Punktetabelle über alle Quizfolien. Schnelle richtige Antworten geben mehr Punkte. */
export function leaderboardOf(deck: Deck, all: Record<string, Resp[]>, types: Record<string, SlideType>) {
  const pts = new Map<string, { name: string; pts: number }>();
  for (const s of deck.slides) {
    const t = types[s.type];
    if (!t?.score) continue;
    for (const r of all[s.id] ?? []) {
      const e = pts.get(r.pid) ?? { name: r.name, pts: 0 };
      e.pts += t.score(s.data, r);
      pts.set(r.pid, e);
    }
  }
  return [...pts.values()].sort((a, b) => b.pts - a.pts);
}

export const quiz: SlideType = {
  id: 'quiz',
  label: 'Quiz: Antwort wählen',
  icon: '🧠',
  category: 'Quiz',
  interactive: true,
  defaults: () => ({ question: 'Quizfrage?', options: ['Richtig', 'Falsch', 'Vielleicht'], correct: 1, points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'options', label: 'Antworten', kind: 'list' },
    { key: 'correct', label: 'Richtige Antwort (Nr., ab 1)', kind: 'number' },
    { key: 'points', label: 'Punkte', kind: 'number' },
  ],
  score: (d, r) => (r.data === d.correct - 1 ? Number(d.points) : 0),
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <Bars options={data.options} counts={tally(data.options.length, ctx.responses)} correct={ctx.reveal ? data.correct - 1 : undefined} />
    </div>
  ),
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.question}</h3>
      <Choice options={data.options} submit={submit} mine={mine} />
      {mine.length > 0 && <p class="hint">Auflösung kommt auf dem großen Bildschirm.</p>}
    </>
  ),
};
