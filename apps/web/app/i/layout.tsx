import { ReactNode } from 'react';

/**
 * O link publico nao tem header nem navegacao: quem abre pode nao ter conta
 * nenhuma, e o menu so ofereceria caminhos que nao servem a essa pessoa.
 */
export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
