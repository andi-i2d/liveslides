import type { SlideType } from '../lib/types';

const PALETTE = ['#fc6933', '#1e8e8e', '#2f6fb0', '#e8556d', '#4a9d5b', '#146c7a', '#c2541d', '#4f5d75'];

/** Zeilen "Label; Zahl" → Datenpunkte. Ungültige Zeilen werden ignoriert. */
export function parsePairs(lines: string[]) {
  return lines
    .map((l) => l.split(';'))
    .filter((p) => p.length >= 2 && p[0].trim() && !Number.isNaN(Number(p[1].replace(',', '.'))))
    .map((p) => ({ label: p[0].trim(), value: Number(p[1].replace(',', '.')) }));
}

export const ytId = (url: string) => String(url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];

export const image: SlideType = {
  id: 'image',
  label: 'Bild (vollflächig)',
  icon: '🖼️',
  category: 'Bild',
  interactive: false,
  defaults: () => ({ url: '', caption: '' }),
  fields: [
    { key: 'url', label: 'Bild', kind: 'image' },
    { key: 'caption', label: 'Bildunterschrift', kind: 'text' },
  ],
  Stage: ({ data }) => (
    <div class="center">
      {data.url ? <img class="pic" style={{ maxHeight: '80%' }} src={data.url} alt={data.caption} /> : <p class="sub">Bild-URL eintragen</p>}
      {data.caption && <p class="sub">{data.caption}</p>}
    </div>
  ),
};

export const quote: SlideType = {
  id: 'quote',
  label: 'Zitat',
  icon: '❝',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ text: 'Ein kluges Zitat.', author: 'Autor/in' }),
  fields: [
    { key: 'text', label: 'Zitat', kind: 'textarea' },
    { key: 'author', label: 'Quelle', kind: 'text' },
  ],
  Stage: ({ data }) => (
    <div class="center">
      <blockquote class="quote">„{data.text}“</blockquote>
      <p class="sub">— {data.author}</p>
    </div>
  ),
};

export const video: SlideType = {
  id: 'video',
  label: 'YouTube-Video',
  icon: '▶️',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ url: '' }),
  fields: [{ key: 'url', label: 'YouTube-Link', kind: 'url' }],
  Stage: ({ data }) => {
    const id = ytId(data.url);
    return id ? (
      <iframe
        class="video"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    ) : (
      <div class="center"><p class="sub">YouTube-Link eintragen</p></div>
    );
  },
};

type DiagramLayout = 'steps' | 'timeline' | 'cycle' | 'hierarchy';

export const diagram: SlideType = {
  id: 'diagram',
  label: 'Diagramm (Schritte, Zeitleiste, Zyklus …)',
  icon: '🔀',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Ablauf', layout: 'steps', items: ['Planen', 'Umsetzen', 'Prüfen', 'Verbessern'] }),
  fields: [
    { key: 'title', label: 'Titel (bei Hierarchie: Wurzel)', kind: 'text' },
    {
      key: 'layout',
      label: 'Layout',
      kind: 'select',
      options: [
        { value: 'steps', label: 'Schritte' },
        { value: 'timeline', label: 'Zeitleiste' },
        { value: 'cycle', label: 'Zyklus' },
        { value: 'hierarchy', label: 'Hierarchie' },
      ],
    },
    { key: 'items', label: 'Einträge', kind: 'list' },
  ],
  Stage: ({ data }) => {
    const items = (data.items as string[]).filter((s) => s.trim());
    const layout = data.layout as DiagramLayout;
    const n = items.length;
    return (
      <div class="col" style={{ height: '100%' }}>
        {layout !== 'hierarchy' && <h2>{data.title}</h2>}
        {layout === 'steps' && (
          <div class="steps">
            {items.map((t, i) => (
              <div class="step" style={{ background: PALETTE[i % PALETTE.length] }}>
                <b>{i + 1}</b>
                {t}
              </div>
            ))}
          </div>
        )}
        {layout === 'timeline' && (
          <div class="timeline">
            {items.map((t, i) => {
              const [when, ...rest] = t.split(';');
              const text = rest.length ? rest.join(';') : when;
              return (
                <div class={'tl ' + (i % 2 ? 'down' : 'up')}>
                  <span class="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <div>
                    {rest.length > 0 && <b>{when}</b>}
                    <div>{text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {layout === 'cycle' && (
          <div class="cycle">
            <div class="ring" />
            {items.map((t, i) => {
              const a = (i / n) * 2 * Math.PI - Math.PI / 2;
              return (
                <div
                  class="node"
                  style={{
                    left: `${50 + 38 * Math.cos(a)}%`,
                    top: `${50 + 38 * Math.sin(a)}%`,
                    background: PALETTE[i % PALETTE.length],
                  }}
                >
                  {t}
                </div>
              );
            })}
          </div>
        )}
        {layout === 'hierarchy' && (
          <div class="tree">
            <div class="root">{data.title}</div>
            <div class="kids">
              {items.map((t, i) => (
                <div class="kid" style={{ borderColor: PALETTE[i % PALETTE.length] }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
};

export const comparison: SlideType = {
  id: 'comparison',
  label: 'Vergleich (Pro/Contra)',
  icon: '⚖️',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Vergleich', leftTitle: 'Pro', left: ['Vorteil 1', 'Vorteil 2'], rightTitle: 'Contra', right: ['Nachteil 1', 'Nachteil 2'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'leftTitle', label: 'Links: Überschrift', kind: 'text' },
    { key: 'left', label: 'Links: Punkte', kind: 'list' },
    { key: 'rightTitle', label: 'Rechts: Überschrift', kind: 'text' },
    { key: 'right', label: 'Rechts: Punkte', kind: 'list' },
  ],
  Stage: ({ data }) => (
    <div class="col">
      <h2>{data.title}</h2>
      <div class="two">
        {[
          [data.leftTitle, data.left, PALETTE[1]],
          [data.rightTitle, data.right, PALETTE[3]],
        ].map(([t, items, c]) => (
          <div class="panelbox" style={{ borderTop: `.4em solid ${c}` }}>
            <h3>{t as string}</h3>
            <ul>{(items as string[]).filter((s) => s.trim()).map((s) => <li>{s}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const swot: SlideType = {
  id: 'swot',
  label: 'SWOT-Analyse',
  icon: '🧭',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'SWOT', s: ['Stärke'], w: ['Schwäche'], o: ['Chance'], t: ['Risiko'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 's', label: 'Stärken', kind: 'list' },
    { key: 'w', label: 'Schwächen', kind: 'list' },
    { key: 'o', label: 'Chancen', kind: 'list' },
    { key: 't', label: 'Risiken', kind: 'list' },
  ],
  Stage: ({ data }) => (
    <div class="col">
      <h2>{data.title}</h2>
      <div class="four">
        {[
          ['Stärken', data.s, PALETTE[1]],
          ['Schwächen', data.w, PALETTE[3]],
          ['Chancen', data.o, PALETTE[4]],
          ['Risiken', data.t, PALETTE[2]],
        ].map(([t, items, c]) => (
          <div class="panelbox" style={{ borderTop: `.4em solid ${c}` }}>
            <h3>{t as string}</h3>
            <ul>{(items as string[]).filter((s) => s.trim()).map((s) => <li>{s}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Diagrammlayouts als reines SVG – keine Bibliothek nötig. */
export function ChartSvg({ kind, rows }: { kind: string; rows: { label: string; value: number }[] }) {
  const W = 800;
  const H = 400;
  const total = rows.reduce((a, r) => a + Math.max(0, r.value), 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (kind === 'pie' || kind === 'donut') {
    let a0 = -Math.PI / 2;
    const cx = 200,
      cy = 200,
      r = 170;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} class="chart">
        {rows.map((row, i) => {
          const a1 = a0 + (Math.max(0, row.value) / total) * 2 * Math.PI;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const full = rows.length === 1;
          const d = full
            ? `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`
            : `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
          a0 = a1;
          return <path d={d} fill={PALETTE[i % PALETTE.length]} />;
        })}
        {kind === 'donut' && <circle cx={cx} cy={cy} r={90} fill="#ffffff" />}
        {rows.map((row, i) => (
          <g transform={`translate(430, ${40 + i * 38})`}>
            <rect width="22" height="22" rx="4" fill={PALETTE[i % PALETTE.length]} />
            <text x="34" y="18" fill="#212121" font-size="22">
              {row.label} – {Math.round((row.value / total) * 100)} %
            </text>
          </g>
        ))}
      </svg>
    );
  }
  const pad = 50;
  const bw = (W - pad * 2) / Math.max(1, rows.length);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#bdbdbd" />
      {kind === 'line' && (
        <polyline
          fill="none"
          stroke={PALETTE[0]}
          stroke-width="4"
          points={rows.map((r, i) => `${pad + bw * i + bw / 2},${y(r.value)}`).join(' ')}
        />
      )}
      {rows.map((r, i) => {
        const x = pad + bw * i;
        return (
          <g>
            {kind === 'line' ? (
              <circle cx={x + bw / 2} cy={y(r.value)} r="7" fill={PALETTE[0]} />
            ) : (
              <rect x={x + bw * 0.15} y={y(r.value)} width={bw * 0.7} height={H - pad - y(r.value)} rx="6" fill={PALETTE[i % PALETTE.length]} />
            )}
            <text x={x + bw / 2} y={y(r.value) - 10} text-anchor="middle" fill="#212121" font-size="20">
              {r.value}
            </text>
            <text x={x + bw / 2} y={H - 18} text-anchor="middle" fill="#5f6368" font-size="18">
              {r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const chart: SlideType = {
  id: 'chart',
  label: 'Diagramm (Balken, Linie, Kreis)',
  icon: '📈',
  category: 'Inhalt',
  interactive: false,
  defaults: () => ({ title: 'Zahlen', kind: 'column', rows: ['Q1; 12', 'Q2; 19', 'Q3; 8', 'Q4; 15'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    {
      key: 'kind',
      label: 'Art',
      kind: 'select',
      options: [
        { value: 'column', label: 'Säulen' },
        { value: 'line', label: 'Linie' },
        { value: 'pie', label: 'Kreis' },
        { value: 'donut', label: 'Ring' },
      ],
    },
    { key: 'rows', label: 'Daten (Zeile: Name; Wert)', kind: 'list' },
  ],
  Stage: ({ data }) => (
    <div class="col">
      <h2>{data.title}</h2>
      <ChartSvg kind={data.kind} rows={parsePairs(data.rows)} />
    </div>
  ),
};
