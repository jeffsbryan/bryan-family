import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { parseHash } from './lib/route';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { PersonPage } from './pages/PersonPage';
import { SurnamePage } from './pages/SurnamePage';

/** Placeholder until the person and tree pages are built. */
function PendingPage() {
  return <h1 className="title">Coming soon</h1>;
}

export function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return (
    <Layout>
      {route.name === 'home' ? (
        <Home />
      ) : route.name === 'surname' ? (
        <SurnamePage surname={route.surname} />
      ) : route.name === 'person' ? (
        <PersonPage id={route.id} />
      ) : route.name === 'tree' ? (
        <PendingPage />
      ) : (
        <NotFound />
      )}
    </Layout>
  );
}
