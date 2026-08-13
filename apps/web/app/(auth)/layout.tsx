import { ReactNode } from 'react';

/**
 * Entrar e cadastrar ficam centrados e sem o header do site: nao ha nada para
 * navegar antes de ter sessao, e o menu so ofereceria caminhos que levariam de
 * volta para ca.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
