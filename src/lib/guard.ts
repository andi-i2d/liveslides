import type { Resp } from './types';

export interface GuardOptions {
  /** max. Nachrichten pro Person und Sekunde */
  maxPerSec: number;
  /** max. Antworten pro Person und Folie (bei Mehrfachantworten) */
  maxPerSlide: number;
  /** max. Größe der Antwortdaten (JSON-Zeichen); Fotos (bis 180 KB) brauchen ca. 245.000 Zeichen */
  maxBytes: number;
  /** max. Gesamtgröße aller Antworten einer Person auf einer Folie (JSON-Zeichen) */
  maxTotalBytes: number;
  /** max. Länge des Anzeigenamens */
  maxName: number;
}
export const DEFAULTS: GuardOptions = { maxPerSec: 8, maxPerSlide: 200, maxBytes: 260_000, maxTotalBytes: 3_000_000, maxName: 30 };

/**
 * Schützt den Präsentator vor Fluten und riesigen Nachrichten (Antworten kommen von beliebigen Handys).
 * `accept` liefert die bereinigte Antwort oder null, wenn sie verworfen wird.
 */
export function createGuard(opts: Partial<GuardOptions> = {}) {
  const o = { ...DEFAULTS, ...opts };
  const recent = new Map<string, number[]>();
  const perSlide = new Map<string, number>();
  const bytesPerSlide = new Map<string, number>();
  return {
    accept(slideId: string, resp: Resp, now = Date.now()): Resp | null {
      if (!resp || typeof resp.pid !== 'string' || !resp.pid || resp.pid.length > 40) return null;
      const stamps = (recent.get(resp.pid) ?? []).filter((t) => now - t < 1000);
      if (stamps.length >= o.maxPerSec) {
        recent.set(resp.pid, stamps);
        return null;
      }
      let size = 0;
      try {
        size = JSON.stringify(resp.data ?? null).length;
      } catch {
        return null;
      }
      if (size > o.maxBytes) return null;
      const key = `${resp.pid}:${slideId}`;
      const n = perSlide.get(key) ?? 0;
      if (n >= o.maxPerSlide) return null;
      if ((bytesPerSlide.get(key) ?? 0) + size > o.maxTotalBytes) return null;
      stamps.push(now);
      recent.set(resp.pid, stamps);
      perSlide.set(key, n + 1);
      bytesPerSlide.set(key, (bytesPerSlide.get(key) ?? 0) + size);
      return { ...resp, name: String(resp.name ?? '').slice(0, o.maxName) || 'Anonym', at: Number.isFinite(resp.at) ? resp.at : now };
    },
  };
}
