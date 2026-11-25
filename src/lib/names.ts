/** Einstellung „Namen der Teilnehmer“: Pflicht (Standard) oder optional. */
export type NameMode = 'required' | 'optional';

export const nameMode = (d?: { settings?: { names?: string } }): NameMode =>
  d?.settings?.names === 'optional' ? 'optional' : 'required';

/** Anonymer Anzeigename, pro Gerät stabil und kurz unterscheidbar (z. B. „Gast K4M“). */
export const guestName = (pid: string, label = 'Gast') =>
  `${label} ${pid.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'X'}`;

/** Endgültiger Name oder null, wenn die Eingabe im gewählten Modus nicht reicht. */
export function resolveName(raw: string, mode: NameMode, pid: string, label?: string): string | null {
  const n = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
  if (n) return n;
  return mode === 'optional' ? guestName(pid, label) : null;
}
