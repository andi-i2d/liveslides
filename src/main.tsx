import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles.css';
import { Home } from './views/Home';
import { Editor } from './views/Editor';
import { Presenter } from './views/Presenter';
import { Join } from './views/Join';

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [, view, arg] = hash.split('/');
  if (view === 'edit') return <Editor key={arg} id={arg} />;
  if (view === 'present') return <Presenter key={arg} id={arg} />;
  if (view === 'join') return <Join key={arg} code={arg ?? ''} />;
  return <Home />;
}

render(<App />, document.getElementById('app')!);
