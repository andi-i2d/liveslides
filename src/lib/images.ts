/**
 * Bilder aus Datei oder Drive werden verkleinert und als Data-URL direkt in die Präsentation eingebettet.
 * Grenze je Bild: 180 KB, damit eine Nachricht über den Realtime-Kanal (Supabase Free: 256 KB) immer passt.
 */
export const MAX_IMAGE_BYTES = 180_000;
/** Platzhalter für ein eingebettetes Bild, das erst noch zum Handy übertragen wird. */
export const PENDING = 'pending:image';

export const isDataUrl = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:');
/** Ungefähre Größe der Nutzdaten einer Base64-Data-URL in Bytes. */
export const dataUrlBytes = (s: string) => Math.max(0, Math.floor(((s.length - s.indexOf(',') - 1) * 3) / 4));

export function fitSize(w: number, h: number, maxSide: number) {
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

const SIDES = [1280, 1024, 800, 640, 480];
const QUALITIES = [0.85, 0.75, 0.65, 0.55];

/** Größen, die nacheinander probiert werden (nie hochskaliert, ohne Doppelte). */
export function candidateSizes(w: number, h: number) {
  const seen = new Set<string>();
  return SIDES.map((s) => fitSize(w, h, s)).filter((d) => !seen.has(`${d.w}x${d.h}`) && !!seen.add(`${d.w}x${d.h}`));
}

async function decode(blob: Blob): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  try {
    const b = await createImageBitmap(blob);
    return { src: b, w: b.width, h: b.height };
  } catch {
    // z. B. SVG: über ein Bild-Element laden
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('decode'));
        img.src = url;
      });
      return { src: img, w: img.naturalWidth || 800, h: img.naturalHeight || 600 };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Bild verkleinern und als JPEG-Data-URL ausgeben (weißer Hintergrund bei Transparenz). */
export async function blobToDataUrl(blob: Blob, maxBytes = MAX_IMAGE_BYTES): Promise<string> {
  if (!blob.type.startsWith('image/')) throw new Error('Das ist keine Bilddatei.');
  let img;
  try {
    img = await decode(blob);
  } catch {
    throw new Error('Das Bild konnte nicht gelesen werden (Format wird vom Browser nicht unterstützt).');
  }
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d')!;
  let last = '';
  for (const size of candidateSizes(img.w, img.h)) {
    canvas.width = size.w;
    canvas.height = size.h;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, size.w, size.h);
    g.drawImage(img.src, 0, 0, size.w, size.h);
    for (const q of QUALITIES) {
      last = canvas.toDataURL('image/jpeg', q);
      if (dataUrlBytes(last) <= maxBytes) return last;
    }
  }
  if (dataUrlBytes(last) <= maxBytes * 1.3) return last;
  throw new Error('Das Bild ist selbst verkleinert noch zu groß. Bitte ein einfacheres Bild wählen.');
}
