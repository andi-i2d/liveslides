import { Component, render, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@fontsource/lato/latin-300.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import './styles.css';
import { Home } from './views/Home';
import { Editor } from './views/Editor';
import { Presenter } from './views/Presenter';
import { Join } from './views/Join';
import { t } from './lib/i18n';
import { AuthGate } from './views/Login';
import { restore } from './lib/google';

/** Fängt Darstellungsfehler einzelner Folien ab, damit nicht die ganze App weiß wird. */
class ErrorBoundary extends Component<{ children: ComponentChildren }, { err?: Error }> {
  state: { err?: Error } = {};
  componentDidCatch(err: Error) {
    console.error(err);
    this.setState({ err });
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div class="page" role="alert">
        <h2>{t('err.title')}</h2>
        <pre class="hint">{String(this.state.err.message)}</pre>
        <a class="btn primary" href="#/" onClick={() => location.reload()}>{t('err.reload')}</a>
      </div>
    );
  }
}

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [, view, arg] = hash.split('/');
  return (
    <ErrorBoundary key={hash}>
      <AuthGate open={view === 'join'}>
        {view === 'edit' ? <Editor key={arg} id={arg} /> :
         view === 'present' ? <Presenter key={arg} id={arg} /> :
         view === 'join' ? <Join key={arg} code={arg ?? ''} /> :
         <Home />}
      </AuthGate>
    </ErrorBoundary>
  );
}

restore(); // erinnertes Google-Konto still wieder anmelden (nur wenn Anmeldung konfiguriert ist)
render(<App />, document.getElementById('app')!);

// Offline-Fähigkeit: Editor und Präsentation laden auch ohne Netz aus dem Cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
