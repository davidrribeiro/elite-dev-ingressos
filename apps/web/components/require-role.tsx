'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useSession } from '@/lib/session';
import type { Role } from '@/lib/types';

/**
 * Bloqueia o conteudo protegido ate confirmar sessao e papel.
 *
 * `useSession()` e reativo: quando `sair()` roda em qualquer lugar da
 * aplicacao, o context muda e todo `RequireRole` montado re-renderiza e
 * redireciona na hora — inclusive numa pagina que ja estava aberta antes do
 * logout, sem precisar de recarregar. Sem este guard, uma pagina protegida
 * so falhava quando tentava chamar a API (401), ou nem isso, se os dados ja
 * estivessem carregados em estado local antes do logout.
 */
export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { user, loading } = useSession();
  const router = useRouter();

  const autorizado = !loading && user?.role === role;

  useEffect(() => {
    if (!loading && !autorizado) {
      router.replace('/');
    }
  }, [loading, autorizado, router]);

  if (!autorizado) return null;

  return <>{children}</>;
}
