import { useEffect, useState } from 'preact/hooks';

/**
 * Google-Anmeldung per Google Identity Services (Token-Flow, läuft komplett im Browser).
 * Die Client-ID ist öffentlich; es gibt kein Client-Secret. Ohne Client-ID ist die Anmeldung aus.
 */
const env = import.meta.env;
export const CLIENT_ID: string = env.VITE_GOOGLE_CLIENT_ID ?? '';
export const ALLOWED_DOMAIN: string = String(env.VITE_ALLOWED_DOMAIN ?? '').trim().toLowerCase().replace(/^@/, '');
export const DRIVE_FOLDER_ID: string = env.VITE_DRIVE_FOLDER_ID ?? '';
export const authEnabled = !!CLIENT_ID;
/** Browser-API-Schlüssel für den Google-Dateiwähler (Picker). Öffentlich, aber in der Cloud Console auf die Website beschränken. */
export const API_KEY: string = env.VITE_GOOGLE_API_KEY ?? '';
/** Projektnummer = Teil der Client-ID vor dem ersten Bindestrich; der Picker braucht sie als App-ID. */
export const PROJECT_NUMBER = CLIENT_ID.split('-')[0];

/** Mit festem Zielordner (z. B. Ordner im geteilten i2d-Laufwerk) braucht die App vollen Drive-Zugriff, sonst nur eigene Dateien. */
export const SCOPES = [
  'openid',
  'email',
  'profile',
  DRIVE_FOLDER_ID ? 'https://www.googleapis.com/auth/drive' : 'https://www.googleapis.com/auth/drive.file',
].join(' ');

export interface User { email: string; name: string; picture?: string; hd?: string }

/** Darf dieses Konto die App nutzen? Ohne Domain-Vorgabe: jedes Konto. */
export function domainAllowed(u: { email?: string; email_verified?: boolean; hd?: string }, domain = ALLOWED_DOMAIN) {
  if (!domain) return true;
  if (!u.email || u.email_verified === false) return false;
  return u.hd?.toLowerCase() === domain || u.email.toLowerCase().endsWith('@' + domain);
}

type Status = 'out' | 'loading' | 'in' | 'error';
interface State { status: Status; user: User | null; error: string }
let state: State = { status: authEnabled ? 'loading' : 'out', user: null, error: '' };
let token: { value: string; exp: number } | null = null;
const subs = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  subs.forEach((f) => f());
};

const HINT = 'liveslides.google.hint';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignorieren */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignorieren */ } },
};

declare const google: any;
let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof google !== 'undefined' && google.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => { gisLoading = null; rej(new Error('Google-Skript konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Holt ein Zugriffstoken. `prompt: 'none'` = still im Hintergrund (klappt nur, wenn schon erlaubt). */
async function requestToken(prompt: '' | 'none' | 'select_account'): Promise<string> {
  await loadGis();
  return new Promise((res, rej) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      hd: ALLOWED_DOMAIN || undefined,
      login_hint: store.get(HINT) || undefined,
      prompt,
      callback: (r: any) => {
        if (r.error || !r.access_token) return rej(new Error(r.error_description || r.error || 'Anmeldung fehlgeschlagen'));
        token = { value: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
        res(r.access_token);
      },
      error_callback: (e: any) => rej(new Error(e?.type || 'Anmeldung abgebrochen')),
    });
    client.requestAccessToken({ prompt });
  });
}

async function loadUser(accessToken: string): Promise<User> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error('Profil konnte nicht geladen werden');
  const p = await r.json();
  if (!domainAllowed(p)) {
    try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch { /* ignorieren */ }
    token = null;
    throw Object.assign(new Error('domain'), { code: 'domain' });
  }
  return { email: p.email, name: p.name ?? p.email, picture: p.picture, hd: p.hd };
}

async function finish(accessToken: string) {
  const user = await loadUser(accessToken);
  store.set(HINT, user.email);
  set({ status: 'in', user, error: '' });
}

/** Interaktive Anmeldung (Klick auf den Knopf). */
export async function signIn() {
  if (!authEnabled) return;
  set({ status: 'loading', error: '' });
  try {
    await finish(await requestToken('select_account'));
  } catch (e: any) {
    set({ status: 'error', user: null, error: e?.code === 'domain' ? 'domain' : String(e?.message ?? e) });
  }
}

/** Beim Start: erinnertes Konto still wieder anmelden, sonst Login-Seite zeigen. */
export async function restore() {
  if (!authEnabled) return;
  if (!store.get(HINT)) return set({ status: 'out' });
  try {
    await finish(await requestToken('none'));
  } catch {
    set({ status: 'out', user: null });
  }
}

export function signOut() {
  const t = token?.value;
  token = null;
  store.del(HINT);
  if (t) { try { google.accounts.oauth2.revoke(t, () => {}); } catch { /* ignorieren */ } }
  set({ status: 'out', user: null, error: '' });
}

/** Gültiges Token für Drive-Aufrufe; erneuert still, wenn abgelaufen. */
export async function getToken(): Promise<string> {
  if (token && token.exp - 60_000 > Date.now()) return token.value;
  if (!authEnabled || state.status !== 'in') throw new Error('Nicht angemeldet');
  try {
    return await requestToken('none');
  } catch {
    set({ status: 'out', user: null });
    throw new Error('Sitzung abgelaufen – bitte neu anmelden');
  }
}

export function useAuth() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return { ...state, signIn, signOut };
}
export const currentUser = () => state.user;
