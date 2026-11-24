import type { ReactNode } from 'react';
import { hrefFor } from '../lib/route';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="site-name" href={hrefFor({ name: 'home' })}>
            Bryan Family Tree
          </a>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
