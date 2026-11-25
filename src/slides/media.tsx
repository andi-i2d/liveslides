import { useRef, useState } from 'preact/hooks';
import type { Resp, SlideType } from '../lib/types';
import { scoreMap, scorePin, scoreShort } from './grading';
import { PENDING, blobToDataUrl } from '../lib/images';

const COLORS = ['#fc6933', '#1e8e8e', '#2f6fb0', '#e8556d', '#4a9d5b', '#146c7a', '#c2541d', '#4f5d75'];
const WORLD = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';
const inputVal = (e: Event) => (e.target as HTMLInputElement).value;

interface Dot { x: number; y: number; color?: string; label?: string; ring?: boolean }

/** Bild mit Markierungen; Klick/Tippen liefert relative Koordinaten (0..1). */
function PinImage({ src, dots, onPick, small }: { src: string; dots: Dot[]; onPick?: (p: [number, number]) => void; small?: boolean }) {
  return (
    <div
      class={'pinimg' + (small ? ' small' : '')}
      onClick={(e) => {
        if (!onPick) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onPick([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
      }}
    >
      {src === PENDING ? <div class="ph">Bild wird geladen …</div> : src ? <img src={src} alt="" draggable={false} /> : <div class="ph">Bild wählen oder URL eintragen</div>}
      {dots.map((d) => (
        <span
          class={'pin' + (d.ring ? ' ring' : '')}
          style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, background: d.ring ? 'transparent' : d.color ?? '#fc6933' }}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

const Submit = ({ mine, onClick, disabled }: { mine: Resp[]; onClick: () => void; disabled?: boolean }) => (
  <button class="btn primary" disabled={disabled || mine.length > 0} onClick={onClick}>{mine.length ? '✓ Gesendet' : 'Absenden'}</button>
);

const pts = (rs: Resp[]) => rs.filter((r) => Array.isArray(r.data)).map((r) => ({ x: (r.data as number[])[0], y: (r.data as number[])[1], color: '#fc6933bb' }));

function PinPlayer({ data, submit, mine, title }: { data: any; submit: (d: any) => void; mine: Resp[]; title: string }) {
  const [p, setP] = useState<[number, number] | null>(null);
  return (
    <>
      <h3>{title}</h3>
      <PinImage src={data.image} small dots={p ? [{ x: p[0], y: p[1] }] : []} onPick={mine.length ? undefined : setP} />
      <p class="hint">Tippe auf die Stelle.</p>
      <Submit mine={mine} disabled={!p} onClick={() => p && submit(p)} />
    </>
  );
}

export const pinImage: SlideType = {
  id: 'pinimage', label: 'Pin auf Bild', icon: '📍', category: 'Bild', interactive: true, phoneImages: true,
  defaults: () => ({ question: 'Wo würdet ihr sitzen?', image: '' }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'image', label: 'Bild', kind: 'image' },
  ],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <PinImage src={data.image} dots={pts(ctx.responses)} />
    </div>
  ),
  Player: (p) => <PinPlayer {...p} title={p.data.question} />,
};

export const pinQuiz: SlideType = {
  id: 'pinquiz', label: 'Quiz: Pin auf Bild', icon: '🎯', category: 'Quiz', interactive: true, phoneImages: true,
  defaults: () => ({ question: 'Wo ist das Ziel?', image: '', x: 50, y: 50, radius: 25, points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'image', label: 'Bild', kind: 'image' },
    { key: 'x', label: 'Ziel X (0–100 %)', kind: 'number' },
    { key: 'y', label: 'Ziel Y (0–100 %)', kind: 'number' },
    { key: 'radius', label: 'Toleranz (% der Bildbreite)', kind: 'number' },
    { key: 'points', label: 'Punkte', kind: 'number' },
  ],
  score: (d, r) => scorePin(d, r.data),
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <PinImage src={data.image} dots={[...pts(ctx.responses), ...(ctx.reveal ? [{ x: data.x / 100, y: data.y / 100, ring: true }] : [])]} />
    </div>
  ),
  Player: (p) => <PinPlayer {...p} title={p.data.question} />,
};

export const mapQuiz: SlideType = {
  id: 'mapquiz', label: 'Quiz: Pin auf Karte', icon: '🗺️', category: 'Quiz', interactive: true, phoneImages: true,
  defaults: () => ({ question: 'Wo liegt Paris?', image: WORLD, lat: 48.85, lon: 2.35, maxKm: 3000, points: 1000 }),
  fields: [
    { key: 'question', label: 'Gesuchter Ort', kind: 'text' },
    { key: 'image', label: 'Weltkarte (Equirectangular, ganze Welt)', kind: 'image' },
    { key: 'lat', label: 'Breite (Lat)', kind: 'number' },
    { key: 'lon', label: 'Länge (Lon)', kind: 'number' },
    { key: 'maxKm', label: 'Ab dieser Entfernung 0 Punkte (km)', kind: 'number' },
    { key: 'points', label: 'Punkte', kind: 'number' },
  ],
  score: (d, r) => scoreMap(d, r.data),
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <PinImage src={data.image} dots={[...pts(ctx.responses), ...(ctx.reveal ? [{ x: (data.lon + 180) / 360, y: (90 - data.lat) / 180, ring: true }] : [])]} />
    </div>
  ),
  Player: (p) => <PinPlayer {...p} title={p.data.question} />,
};

/** Zeilen "x; y; Text" → Hotspots. */
export function parseHotspots(lines: string[]) {
  return lines
    .map((l) => l.split(';').map((s) => s.trim()))
    .filter((p) => p.length >= 3 && !Number.isNaN(Number(p[0])) && !Number.isNaN(Number(p[1])))
    .slice(0, 8)
    .map((p) => ({ x: Number(p[0]) / 100, y: Number(p[1]) / 100, text: p.slice(2).join('; ') }));
}

export const hotspots: SlideType = {
  id: 'hotspots', label: 'Interaktives Bild', icon: '👆', category: 'Bild', interactive: true, phoneImages: true, multi: true,
  defaults: () => ({ title: 'Entdeckt das Bild', image: '', pins: ['25; 40; Erste Info', '70; 60; Zweite Info'] }),
  fields: [
    { key: 'title', label: 'Titel', kind: 'text' },
    { key: 'image', label: 'Bild', kind: 'image' },
    { key: 'pins', label: 'Pins (x %; y %; Text, max. 8)', kind: 'list' },
  ],
  Stage: ({ data, ctx }) => {
    const h = parseHotspots(data.pins);
    const c = h.map((_, i) => ctx.responses.filter((r) => r.data === i).length);
    return (
      <div class="col">
        <h2>{data.title}</h2>
        <PinImage src={data.image} dots={h.map((p, i) => ({ x: p.x, y: p.y, label: String(i + 1), color: COLORS[i % 8] }))} />
        <p class="hint">Aufrufe: {h.map((p, i) => `${i + 1}: ${c[i]}`).join(' · ')}</p>
      </div>
    );
  },
  Player: ({ data, submit }) => {
    const h = parseHotspots(data.pins);
    const [open, setOpen] = useState(-1);
    return (
      <>
        <h3>{data.title}</h3>
        <div class="pinimg small">
          {data.image && data.image !== PENDING && <img src={data.image} alt="" />}
          {h.map((p, i) => (
            <button class="pin tap" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: COLORS[i % 8] }} onClick={() => { setOpen(i); submit(i); }}>{i + 1}</button>
          ))}
        </div>
        {open >= 0 && <div class="panelbox"><b>{open + 1}.</b> {h[open].text}</div>}
      </>
    );
  },
};

type Stroke = { c: string; p: [number, number][] };

function strokePath(s: Stroke) {
  return s.p.map((q, i) => `${i ? 'L' : 'M'}${q[0] * 1000},${q[1] * 1000}`).join(' ');
}

export const annotate: SlideType = {
  id: 'annotate', label: 'Auf Bild zeichnen', icon: '🖍️', category: 'Bild', interactive: true, phoneImages: true,
  defaults: () => ({ question: 'Markiert, was euch auffällt', image: '' }),
  fields: [
    { key: 'question', label: 'Aufgabe', kind: 'text' },
    { key: 'image', label: 'Bild', kind: 'image' },
  ],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <div class="pinimg">
        {data.image && data.image !== PENDING && <img src={data.image} alt="" />}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" class="over">
          {ctx.responses.flatMap((r, i) => ((r.data as Stroke[]) ?? []).map((s) => <path d={strokePath(s)} stroke={COLORS[i % 8]} fill="none" stroke-width="5" stroke-linecap="round" />))}
        </svg>
      </div>
    </div>
  ),
  Player: ({ data, submit, mine }) => {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const cur = useRef<Stroke | null>(null);
    const rel = (e: PointerEvent): [number, number] => {
      const r = (e.currentTarget as SVGElement).getBoundingClientRect();
      return [Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000, Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000];
    };
    const done = mine.length > 0;
    return (
      <>
        <h3>{data.question}</h3>
        <div class="pinimg small">
          {data.image && data.image !== PENDING && <img src={data.image} alt="" />}
          <svg
            viewBox="0 0 1000 1000" preserveAspectRatio="none" class="over draw"
            onPointerDown={(e) => { if (done) return; (e.currentTarget as SVGElement).setPointerCapture(e.pointerId); cur.current = { c: '#fc6933', p: [rel(e)] }; setStrokes((s) => [...s, cur.current!]); }}
            onPointerMove={(e) => { if (!cur.current) return; cur.current.p.push(rel(e)); setStrokes((s) => [...s]); }}
            onPointerUp={() => (cur.current = null)}
          >
            {strokes.map((s) => <path d={strokePath(s)} stroke="#fc6933" fill="none" stroke-width="5" stroke-linecap="round" />)}
          </svg>
        </div>
        <button class="btn" disabled={done} onClick={() => setStrokes([])}>Löschen</button>{' '}
        <Submit mine={mine} disabled={!strokes.length} onClick={() => submit(strokes.slice(0, 40).map((s) => ({ c: s.c, p: s.p.filter((_, i) => i % 2 === 0 || i === s.p.length - 1).slice(0, 150) })))} />
      </>
    );
  },
};

function DrawPad({ onDone, disabled }: { onDone: (url: string) => void; disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const ctx = () => {
    const c = ref.current!.getContext('2d')!;
    c.lineWidth = 5; c.lineCap = 'round'; c.strokeStyle = '#111';
    return c;
  };
  const pos = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 300, ((e.clientY - r.top) / r.height) * 300];
  };
  const init = (c: HTMLCanvasElement | null) => {
    if (!c || (ref as any).current === c) return;
    (ref as any).current = c;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300);
  };
  return (
    <>
      <canvas
        ref={init} width={300} height={300} class="pad"
        onPointerDown={(e) => { if (disabled) return; down.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const [x, y] = pos(e); const g = ctx(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.1, y + 0.1); g.stroke(); }}
        onPointerMove={(e) => { if (!down.current) return; const [x, y] = pos(e); const g = ctx(); g.lineTo(x, y); g.stroke(); }}
        onPointerUp={() => (down.current = false)}
      />
      <button class="btn" disabled={disabled} onClick={() => { const g = ref.current!.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 300); }}>Löschen</button>{' '}
      <button class="btn primary" disabled={disabled} onClick={() => onDone(ref.current!.toDataURL('image/jpeg', 0.6))}>{disabled ? '✓ Gesendet' : 'Absenden'}</button>
    </>
  );
}

function Gallery({ rs }: { rs: Resp[] }) {
  return (
    <div class="gallery">
      {[...rs].reverse().slice(0, 24).map((r) => {
        const d = r.data as { img: string; cap?: string };
        return (
          <figure>
            <img src={d.img} alt="" />
            <figcaption>{d.cap || r.name}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export const drawAnswer: SlideType = {
  id: 'drawanswer', label: 'Antwort zeichnen', icon: '🎨', category: 'Bild', interactive: true,
  defaults: () => ({ question: 'Zeichnet euer Lieblingstier' }),
  fields: [{ key: 'question', label: 'Aufgabe', kind: 'text' }],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <Gallery rs={ctx.responses.map((r) => ({ ...r, data: { img: r.data, cap: r.name } }))} />
    </div>
  ),
  Player: ({ data, submit, mine }) => (
    <>
      <h3>{data.question}</h3>
      <DrawPad disabled={mine.length > 0} onDone={submit} />
    </>
  ),
};

/**
 * Foto teilen: Teilnehmende senden Fotos (bis ca. 1280 px, max. 180 KB), der Präsentator-Browser legt sie automatisch im
 * Ordner Fotos der Präsentation in Drive ab (Angemeldet sein ist nötig, sonst werden sie nur gezeigt).
 */
export const photoShare: SlideType = {
  id: 'photoshare', label: 'Foto teilen (landet in Drive)', icon: '📷', category: 'Bild', interactive: true, multi: true, driveDrop: true,
  defaults: () => ({ question: 'Teilt eure Fotos mit uns', max: 5, gallery: 'yes' }),
  fields: [
    { key: 'question', label: 'Aufgabe', kind: 'text' },
    { key: 'max', label: 'Fotos pro Person', kind: 'number' },
    { key: 'gallery', label: 'Fotos auf dem Beamer zeigen', kind: 'select', options: [{ value: 'yes', label: 'Ja, als Galerie' }, { value: 'no', label: 'Nein, nur Zähler' }] },
  ],
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <p class="sub">📷 {ctx.responses.length} Foto{ctx.responses.length === 1 ? '' : 's'} erhalten</p>
      {data.gallery !== 'no' && <Gallery rs={ctx.responses} />}
    </div>
  ),
  Player: ({ data, submit, mine }) => {
    const [img, setImg] = useState('');
    const [cap, setCap] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const left = Number(data.max) - mine.length;
    return (
      <>
        <h3>{data.question}</h3>
        {left > 0 ? (
          <>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (!f) return;
                setBusy(true); setErr('');
                try { setImg(await blobToDataUrl(f)); } catch (x: any) { setErr(String(x?.message ?? x)); }
                setBusy(false);
              }}
            />
            {busy && <p class="hint" role="status">Foto wird verkleinert …</p>}
            {err && <p class="warn" role="alert">{err}</p>}
            {img && <img class="preview" src={img} alt="" />}
            <input placeholder="Bildunterschrift (optional)" maxLength={60} value={cap} onInput={(e) => setCap(inputVal(e))} />
            <button class="btn primary" disabled={!img || busy} onClick={() => { submit({ img, cap }); setImg(''); setCap(''); }}>Senden</button>
            <p class="hint">
              Dein Foto {data.gallery !== 'no' ? 'wird auf dem Beamer gezeigt und ' : ''}wird von den Veranstaltenden gespeichert. Noch {left} Foto{left === 1 ? '' : 's'} möglich.
            </p>
          </>
        ) : <p class="hint">✓ {mine.length} Foto{mine.length === 1 ? '' : 's'} gesendet. Danke!</p>}
      </>
    );
  },
};
export const guessImage: SlideType = {
  id: 'guessimage', label: 'Quiz: Bild erraten', icon: '🕵️', category: 'Quiz', interactive: true,
  defaults: () => ({ question: 'Was ist das?', image: '', answers: ['Eiffelturm'], points: 1000 }),
  fields: [
    { key: 'question', label: 'Frage', kind: 'text' },
    { key: 'image', label: 'Bild', kind: 'image' },
    { key: 'answers', label: 'Akzeptierte Antworten', kind: 'list' },
    { key: 'points', label: 'Punkte', kind: 'number' },
  ],
  score: (d, r) => scoreShort(d, r.data),
  Stage: ({ data, ctx }) => (
    <div class="col">
      <h2>{data.question}</h2>
      <div class="pinimg"><img src={data.image} alt="" class={ctx.reveal ? '' : 'blurred'} /></div>
      <p class="sub">{ctx.responses.length} Antwort(en){ctx.reveal && ` · Lösung: ${data.answers.filter((s: string) => s.trim()).join(' / ')}`}</p>
    </div>
  ),
  Player: ({ data, submit, mine }) => {
    const [v, setV] = useState('');
    return (
      <>
        <h3>{data.question}</h3>
        <input value={v} disabled={mine.length > 0} onInput={(e) => setV(inputVal(e))} />
        <Submit mine={mine} disabled={!v.trim()} onClick={() => submit(v.trim())} />
      </>
    );
  },
};
