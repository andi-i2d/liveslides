import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ALLOWED_DOMAIN, authEnabled, useAuth } from '../lib/google';
import { t, useLang } from '../lib/i18n';

/** Schützt Editor, Startseite und Präsentator. Teilnehmer (#/join) brauchen keine Anmeldung. */
export function AuthGate({ children, open }: { children: ComponentChildren; open: boolean }) {
  useLang();
  const a = useAuth();
  const [code, setCode] = useState('');
  if (!authEnabled || open || a.status === 'in') return <>{children}</>;
  if (a.status === 'loading')
    return <div class="page narrow"><p role="status" class="hint">…</p></div>;
  return (
    <div class="page narrow login">
      <h1>LiveSlides</h1>
      <h2>{t('auth.title')}</h2>
      <p>{t('auth.sub')}</p>
      {ALLOWED_DOMAIN && <p class="hint">{t('auth.domain')}{ALLOWED_DOMAIN}</p>}
      {a.status === 'error' && (
        <p class="warn" role="alert">
          {a.error === 'domain' ? t('auth.wrongDomain') : `${t('auth.error')} ${a.error}`}
        </p>
      )}
      <button class="btn primary big" onClick={() => a.signIn()}>{t('auth.signin')}</button>
      <section>
        <p class="hint">{t('auth.joinHint')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) location.hash = `#/join/${code.trim().toUpperCase()}`;
          }}
        >
          <input aria-label={t('home.code')} placeholder={t('home.code')} value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <button class="btn">{t('home.joinBtn')}</button>
        </form>
      </section>
    </div>
  );
}
