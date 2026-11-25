import type { Deck, Resp, SlideType } from './types';
import { isDataUrl } from './images';

/** Foto aus einer Antwort: Foto-Drop/Foto teilen senden {img, cap}, Antwort zeichnen sendet die Data-URL direkt. */
export function imageOf(data: unknown): string | null {
  if (isDataUrl(data)) return data;
  const img = (data as { img?: unknown } | null)?.img;
  return isDataUrl(img) ? img : null;
}

/** Data-URL → Blob (ohne fetch, damit es überall gleich funktioniert). */
export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',');
  const meta = url.slice(5, comma); // „image/jpeg;base64“
  const mime = meta.split(';')[0] || 'application/octet-stream';
  const bin = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const extFor = (mime: string) => EXT[mime] ?? 'img';

/** Dateiname: „2026-11-25 10.30.05 Lustiger Luchs 3.jpg“ (Zeitpunkt der Aufnahme, Name, laufende Nummer). */
export function photoFileName(at: number, name: string, n: number, mime = 'image/jpeg') {
  const d = new Date(at);
  const p = (x: number) => String(x).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
  return `${stamp} ${name} ${n}.${extFor(mime)}`;
}

export interface PendingDrop { key: string; slideId: string; resp: Resp; img: string }

/** Noch nicht gespeicherte Fotos von Folien mit Foto-Drop (`driveDrop`), in Eingangsreihenfolge. */
export function pendingDrops(
  deck: Deck,
  all: Record<string, Resp[]>,
  done: ReadonlySet<string>,
  types: Record<string, Pick<SlideType, 'driveDrop'> | undefined>,
): PendingDrop[] {
  const out: PendingDrop[] = [];
  for (const s of deck.slides) {
    if (!types[s.type]?.driveDrop) continue;
    for (const r of all[s.id] ?? []) {
      const img = imageOf(r.data);
      const key = `${s.id}:${r.pid}:${r.at}`;
      if (img && !done.has(key)) out.push({ key, slideId: s.id, resp: r, img });
    }
  }
  return out.sort((a, b) => a.resp.at - b.resp.at);
}
