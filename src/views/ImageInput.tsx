import { useEffect, useRef, useState } from 'preact/hooks';
import { t, useLang } from '../lib/i18n';
import { blobToDataUrl, dataUrlBytes, isDataUrl } from '../lib/images';
import { cloudGetBlob, cloudListImages, cloudReady } from '../lib/cloud';
import type { DriveImage } from '../lib/drive';
import { pickDriveImage, pickerAvailable } from '../lib/picker';
import { PhotosError, pickGooglePhoto, type PhotosStatus } from '../lib/photos';

/** Drive-Dateien über 25 MB werden nicht geladen (zu groß zum Verkleinern im Browser). */
const MAX_DRIVE_BYTES = 25_000_000;

function DrivePicker({ onPick, onClose }: { onPick: (img: DriveImage) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DriveImage[] | null>(null);
  const [err, setErr] = useState('');
  const load = async (s: string) => {
    setItems(null);
    setErr('');
    try {
      setItems(await cloudListImages(s));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setItems([]);
    }
  };
  useEffect(() => void load(''), []);
  return (
    <div class="drivepick" role="dialog" aria-label={t('image.fromDrive')}>
      <form class="row" onSubmit={(e) => { e.preventDefault(); load(search); }}>
        <input class="grow" type="search" placeholder={t('image.driveSearch')} value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
        <button class="btn">{t('image.search')}</button>
        <button type="button" class="btn" aria-label={t('image.close')} onClick={onClose}>✕</button>
      </form>
      {err && <p class="warn" role="alert">{err}</p>}
      {items === null && <p class="hint" role="status">{t('cloud.loading')}</p>}
      {items && items.length === 0 && !err && <p class="hint">{t('image.driveEmpty')}</p>}
      <ul class="drivelist">
        {items?.map((i) => (
          <li>
            <span class="grow" title={i.name}>🖼 {i.name}</span>
            <small class="hint">{new Date(i.modifiedTime).toLocaleDateString()}</small>
            <button type="button" class="btn" disabled={Number(i.size) > MAX_DRIVE_BYTES} onClick={() => onPick(i)}>{t('image.choose')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bildfeld im Editor: URL eintippen, Datei vom Rechner wählen oder (angemeldet) aus Google Drive holen.
 * Dateien werden verkleinert (max. 180 KB) und direkt in die Präsentation eingebettet.
 */
export function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  useLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drive, setDrive] = useState(false);
  const [photos, setPhotos] = useState<PhotosStatus | null>(null);
  const abort = useRef<AbortController | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const embedded = isDataUrl(value);

  const take = async (get: () => Promise<Blob>) => {
    setBusy(true);
    setErr('');
    try {
      onChange(await blobToDataUrl(await get()));
      setDrive(false);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
    setBusy(false);
  };


  /** Google Fotos: Auswahl im Google-Fotos-Fenster, danach wie jede andere Quelle verkleinern und einbetten. */
  const startPhotos = async () => {
    setErr('');
    const c = new AbortController();
    abort.current = c;
    try {
      const blob = await pickGooglePhoto(c.signal, setPhotos);
      setPhotos(null);
      await take(async () => blob);
    } catch (e: any) {
      if (!(e instanceof PhotosError && e.code === 'cancelled')) setErr(String(e?.message ?? e));
    } finally {
      setPhotos(null);
      abort.current = null;
    }
  };
  return (
    <div class="imginput">
      {embedded ? (
        <div class="imgchip">
          <img src={value} alt="" />
          <span class="grow">{t('image.embedded')} · {Math.round(dataUrlBytes(value) / 1000)} KB</span>
          <button type="button" class="btn" onClick={() => onChange('')}>{t('image.remove')}</button>
        </div>
      ) : (
        <input value={value} placeholder="https://…" aria-label={t('image.url')} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
      )}
      <div class="row wrap">
        <button type="button" class="btn" disabled={busy} onClick={() => file.current?.click()}>{t('image.fromComputer')}</button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          aria-label={t('image.fromComputer')}
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            (e.target as HTMLInputElement).value = ''; // dieselbe Datei nochmal wählbar
            if (f) take(async () => f);
          }}
        />
        {cloudReady() && (
          <button
            type="button"
            class="btn"
            disabled={busy}
            onClick={async () => {
              if (!pickerAvailable) return setDrive((d) => !d); // ohne API-Schlüssel: eigene Liste
              setErr('');
              try {
                const f = await pickDriveImage(); // Standard-Dateiwähler von Google mit Vorschau
                if (f) take(() => cloudGetBlob(f.id));
              } catch (e: any) {
                setErr(String(e?.message ?? e));
              }
            }}
          >
            {t('image.fromDrive')}
          </button>
        )}
        {cloudReady() && (
          <button type="button" class="btn" disabled={busy || !!photos} onClick={startPhotos}>
            {t('image.fromPhotos')}
          </button>
        )}
      </div>
      {photos && (
        <div class="photostatus" role="status">
          <p>{photos.state === 'waiting' ? t('image.photosWaiting') : t('image.processing')}</p>
          <div class="row wrap">
            {photos.state === 'waiting' && photos.blocked && (
              <>
                <small class="hint">{t('image.photosBlocked')}</small>
                <button type="button" class="btn primary" onClick={() => window.open(photos.pickerUri, '_blank')}>{t('image.photosOpen')}</button>
              </>
            )}
            <button type="button" class="btn" onClick={() => abort.current?.abort()}>{t('image.cancel')}</button>
          </div>
        </div>
      )}
      {busy && <p class="hint" role="status">{t('image.processing')}</p>}
      {err && <p class="warn" role="alert">{err}</p>}
      {drive && <DrivePicker onClose={() => setDrive(false)} onPick={(img) => take(() => cloudGetBlob(img.id))} />}
    </div>
  );
}
