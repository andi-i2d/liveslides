import { useEffect, useState } from 'preact/hooks';

export type Lang = 'de' | 'en';

const dict = {
  de: {
    'home.noBackend': 'Kein Supabase konfiguriert – Live-Teilnahme nur im selben Browser (Testmodus). Siehe README.',
    'home.join': 'Mitmachen',
    'home.code': 'Code, z. B. K4M9P',
    'home.joinBtn': 'Beitreten',
    'home.decks': 'Meine Präsentationen',
    'home.slides': 'Folien',
    'home.edit': 'Bearbeiten',
    'home.present': 'Präsentieren',
    'home.confirmDelete': 'Löschen?',
    'home.new': '+ Neue Präsentation',
    'home.import': 'Importieren (JSON)',
    'home.badFile': 'Datei konnte nicht gelesen werden.',
    'editor.back': '← Start',
    'editor.add': '+ Folie hinzufügen …',
    'editor.deckTitle': 'Titel der Präsentation',
    'editor.present': '▶ Präsentieren',
    'editor.export': 'Exportieren (JSON)',
    'editor.notFound': 'Nicht gefunden.',
    'present.reveal': '👁 Auflösen',
    'present.hide': '🙈 Verbergen',
    'present.step': '⏭ Schritt',
    'present.code': 'Code',
    'join.title': 'Beitreten:',
    'join.name': 'Dein Name',
    'join.go': 'Los!',
    'join.wait': 'Warte auf den Präsentator …',
    'join.look': 'Schau auf den großen Bildschirm 👀',
    'err.title': 'Etwas ist schiefgelaufen.',
    'err.reload': 'Neu laden',
    'auth.title': 'Anmelden',
    'auth.sub': 'Melde dich mit deinem Google-Konto an. Präsentationen und Ergebnisse werden dann automatisch in Google Drive gespeichert.',
    'auth.signin': 'Mit Google anmelden',
    'auth.domain': 'Nur Konten von @',
    'auth.wrongDomain': 'Dieses Konto ist hier nicht zugelassen. Bitte mit einem Konto der Organisation anmelden.',
    'auth.error': 'Anmeldung fehlgeschlagen:',
    'auth.signout': 'Abmelden',
    'auth.joinHint': 'Du willst nur teilnehmen? Dafür brauchst du keine Anmeldung:',
    'cloud.saving': '☁ Speichert …',
    'cloud.saved': '☁ In Drive gespeichert',
    'cloud.error': '⚠ Drive-Fehler',
    'cloud.saveNow': 'Jetzt in Drive speichern',
    'cloud.load': 'Aus Google Drive laden',
    'cloud.loading': 'Lade …',
    'cloud.empty': 'Keine Präsentationen in Drive gefunden.',
    'cloud.import': 'Importieren',
    'qr.show': 'QR-Code',
    'qr.close': 'Zum Schließen klicken oder Taste Q',
    'a11y.prev': 'Vorherige Folie',
    'a11y.next': 'Nächste Folie',
    'a11y.close': 'Präsentation beenden',
    'a11y.fullscreen': 'Vollbild',
    'a11y.delete': 'Löschen',
    'a11y.lang': 'Sprache',
  },
  en: {
    'home.noBackend': 'No Supabase configured – live participation only works in the same browser (test mode). See README.',
    'home.join': 'Join',
    'home.code': 'Code, e.g. K4M9P',
    'home.joinBtn': 'Join',
    'home.decks': 'My presentations',
    'home.slides': 'slides',
    'home.edit': 'Edit',
    'home.present': 'Present',
    'home.confirmDelete': 'Delete?',
    'home.new': '+ New presentation',
    'home.import': 'Import (JSON)',
    'home.badFile': 'The file could not be read.',
    'editor.back': '← Home',
    'editor.add': '+ Add slide …',
    'editor.deckTitle': 'Presentation title',
    'editor.present': '▶ Present',
    'editor.export': 'Export (JSON)',
    'editor.notFound': 'Not found.',
    'present.reveal': '👁 Reveal',
    'present.hide': '🙈 Hide',
    'present.step': '⏭ Step',
    'present.code': 'Code',
    'join.title': 'Join:',
    'join.name': 'Your name',
    'join.go': 'Go!',
    'join.wait': 'Waiting for the presenter …',
    'join.look': 'Look at the big screen 👀',
    'err.title': 'Something went wrong.',
    'err.reload': 'Reload',
    'auth.title': 'Sign in',
    'auth.sub': 'Sign in with your Google account. Presentations and results are then saved to Google Drive automatically.',
    'auth.signin': 'Sign in with Google',
    'auth.domain': 'Only accounts from @',
    'auth.wrongDomain': 'This account is not allowed here. Please sign in with an organisation account.',
    'auth.error': 'Sign-in failed:',
    'auth.signout': 'Sign out',
    'auth.joinHint': 'Just want to take part? No sign-in needed:',
    'cloud.saving': '☁ Saving …',
    'cloud.saved': '☁ Saved to Drive',
    'cloud.error': '⚠ Drive error',
    'cloud.saveNow': 'Save to Drive now',
    'cloud.load': 'Load from Google Drive',
    'cloud.loading': 'Loading …',
    'cloud.empty': 'No presentations found in Drive.',
    'cloud.import': 'Import',
    'qr.show': 'QR code',
    'qr.close': 'Click or press Q to close',
    'a11y.prev': 'Previous slide',
    'a11y.next': 'Next slide',
    'a11y.close': 'End presentation',
    'a11y.fullscreen': 'Fullscreen',
    'a11y.delete': 'Delete',
    'a11y.lang': 'Language',
  },
} as const;

export type Key = keyof (typeof dict)['de'];

const read = (): Lang => {
  if (typeof window !== 'undefined') {
    try {
      const s = localStorage.getItem('liveslides.lang');
      if (s === 'de' || s === 'en') return s;
    } catch { /* Speicher gesperrt */ }
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
};

let lang: Lang = read();
const subs = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('liveslides.lang', l); } catch { /* ignorieren */ }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  subs.forEach((f) => f());
}
export const t = (k: Key): string => dict[lang][k] ?? dict.de[k];

/** Hook: Komponente wird bei Sprachwechsel neu gerendert. */
export function useLang() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return lang;
}

/** Fehlende Übersetzungen finden (für Tests). */
export const missingKeys = () => (Object.keys(dict.de) as Key[]).filter((k) => !(k in dict.en));
