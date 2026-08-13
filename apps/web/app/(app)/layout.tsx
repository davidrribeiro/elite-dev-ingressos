import { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';

/** Telas com sessao: header por papel e conteudo na largura da grade. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}
