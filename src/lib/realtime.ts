import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { Msg } from './types';

export interface Channel {
  send(m: Msg): void;
  close(): void;
}

export const hasBackend = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
let client: ReturnType<typeof createClient> | null = null;

/** Öffnet den Session-Kanal. Supabase Realtime Broadcast, sonst BroadcastChannel. */
export function openChannel(code: string, onMsg: (m: Msg) => void): Channel {
  const name = `ls-${code.toUpperCase()}`;
  if (hasBackend) {
    client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const ch = client.channel(name, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload as Msg)).subscribe();
    return {
      send: (m) => void ch.send({ type: 'broadcast', event: 'm', payload: m }),
      close: () => void client!.removeChannel(ch),
    };
  }
  const bc = new BroadcastChannel(name);
  bc.onmessage = (e) => onMsg(e.data as Msg);
  return { send: (m) => bc.postMessage(m), close: () => bc.close() };
}
