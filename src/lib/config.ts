// Supabase-Zugangsdaten. Der anon-Key ist öffentlich gedacht (nur Broadcast-Channel, keine Tabellen).
// Ohne Eintrag fällt die App auf BroadcastChannel zurück (nur gleicher Browser, gut zum Testen).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
