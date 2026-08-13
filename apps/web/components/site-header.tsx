'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import type { Role } from '@/lib/types';

/**
 * Cada papel ve apenas o que opera.
 *
 * A portaria nao ve "Meus ingressos" e o cliente nao ve o painel do
 * organizador — nao por seguranca, que mora nos guards da API, mas porque
 * quem esta na porta do cinema nao deveria precisar filtrar itens de menu que
 * nunca vai usar.
 */
const NAVEGACAO: Record<Role, { href: string; label: string }[]> = {
  CUSTOMER: [
    { href: '/', label: 'Sessoes' },
    { href: '/ingressos', label: 'Meus ingressos' },
  ],
  ORGANIZER: [
    { href: '/', label: 'Sessoes' },
    { href: '/organizador', label: 'Painel' },
  ],
  GATE: [{ href: '/portaria', label: 'Validar ingresso' }],
};

const VISITANTE = [{ href: '/', label: 'Sessoes' }];

export function SiteHeader() {
  const { user, loading, sair } = useSession();
  const pathname = usePathname();

  const itens = user ? NAVEGACAO[user.role] : VISITANTE;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight text-ink">
          Elite<span className="text-accent">Events</span>
        </Link>

        <nav className="flex items-center gap-1">
          {itens.map((item) => {
            const ativo =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'rounded-md px-2.5 py-1.5 font-medium transition-colors',
                  ativo
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Durante a revalidacao do token nada e mostrado: piscar "Entrar"
              para quem ja esta logado e pior que meio segundo de vazio. */}
          {loading ? null : user ? (
            <>
              <span className="hidden text-muted sm:inline">
                {user.name}
                <span className="ml-1.5 text-faint">{rotuloDoPapel(user.role)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={sair}>
                Sair
              </Button>
            </>
          ) : (
            <>
              {/* Links, e nao <Button>: sao navegacao. Envolver um <Link> num
                  <button> geraria <button><a>, que e HTML invalido e quebra o
                  clique do meio e o "abrir em nova aba". */}
              <Link
                href="/entrar"
                className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Entrar
              </Link>
              <Link
                href="/cadastrar"
                className="inline-flex h-7 items-center rounded-md bg-accent px-2.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function rotuloDoPapel(role: Role): string {
  return { CUSTOMER: 'cliente', ORGANIZER: 'organizador', GATE: 'portaria' }[
    role
  ];
}
