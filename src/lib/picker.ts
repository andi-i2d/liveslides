import { API_KEY, PROJECT_NUMBER, authEnabled, getToken } from './google';
import { getLang } from './i18n';

/**
 * Standard-Dateiwähler von Google (Picker) mit Vorschaubildern, „Meine Ablage“, geteilten Laufwerken und
 * „Mit mir geteilt“. Braucht einen API-Schlüssel (VITE_GOOGLE_API_KEY); ohne Schlüssel bleibt die eigene Liste.
 * Das Google-Skript wird erst beim ersten Öffnen geladen.
 */
declare const gapi: any;
declare const google: any;

export const pickerAvailable = authEnabled && !!API_KEY;

let loading: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  if (typeof google !== 'undefined' && google.picker) return Promise.resolve();
  loading ??= new Promise<void>((res, rej) => {
    const fail = (m: string) => { loading = null; rej(new Error(m)); };
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.async = true;
    s.onerror = () => fail('Das Google-Dateiwähler-Skript konnte nicht geladen werden.');
    s.onload = () => gapi.load('picker', { callback: () => res(), onerror: () => fail('Der Google-Dateiwähler konnte nicht gestartet werden.') });
    document.head.appendChild(s);
  });
  return loading;
}

export interface PickedFile { id: string; name: string }

/** Öffnet den Google-Dateiwähler für Bilder. Liefert die gewählte Datei oder null bei „Abbrechen“. */
export async function pickDriveImage(): Promise<PickedFile | null> {
  await loadPicker();
  const token = await getToken();
  const p = google.picker;
  const images = new p.DocsView(p.ViewId.DOCS_IMAGES).setIncludeFolders(true).setEnableDrives(true).setMode(p.DocsViewMode.GRID);
  const shared = new p.DocsView(p.ViewId.DOCS_IMAGES).setOwnedByMe(false).setIncludeFolders(true).setMode(p.DocsViewMode.GRID);
  return new Promise<PickedFile | null>((resolve) => {
    new p.PickerBuilder()
      .setAppId(PROJECT_NUMBER)
      .setDeveloperKey(API_KEY)
      .setOAuthToken(token)
      .setLocale(getLang())
      .enableFeature(p.Feature.SUPPORT_DRIVES)
      .addView(images)
      .addView(shared)
      .setCallback((d: any) => {
        const action = d[p.Response.ACTION];
        if (action === p.Action.PICKED) {
          const doc = d[p.Response.DOCUMENTS][0];
          resolve({ id: doc[p.Document.ID], name: doc[p.Document.NAME] });
        } else if (action === p.Action.CANCEL) {
          resolve(null);
        }
      })
      .build()
      .setVisible(true);
  });
}
