'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { RequireRole } from '@/components/require-role';
import { GateSessionSummary, lerSessaoPortaria } from '@/lib/gate-session';
import { formatarData } from '@/lib/money';

const ROTA_ESCOLHA = '/portaria/sessoes';

/**
 * Guarda de toda a area de portaria, em duas camadas.
 *
 * `RequireRole` cobre a sessao de autenticacao: sem ela, um logout com a
 * tela de validar aberta deixava o resultado da ultima leitura visivel
 * indefinidamente, porque nada aqui dependia de `user` — so do
 * localStorage da sessao escolhida, que o logout nao mexe.
 *
 * `GuardaDeSessao` cobre a escolha de qual evento validar: sem ela, nao ha
 * validacao possivel — bloqueia a renderizacao dos filhos e redireciona
 * para a escolha, em vez de deixar a tela de validar tentar chamar a API
 * sem `eventId`.
 */
export default function PortariaLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="GATE">
      <GuardaDeSessao>{children}</GuardaDeSessao>
    </RequireRole>
  );
}

/**
 * `children` so renderiza depois que a sessao e confirmada (ou na propria
 * pagina de escolha), o que evita a corrida entre o guard e a pagina filha
 * tentando ler o mesmo localStorage ao mesmo tempo.
 */
function GuardaDeSessao({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessao, setSessao] = useState<GateSessionSummary | null | undefined>(undefined);

  const naPaginaDeEscolha = pathname === ROTA_ESCOLHA;

  useEffect(() => {
    function verificar() {
      const salva = lerSessaoPortaria();
      setSessao(salva);
      if (!salva && !naPaginaDeEscolha) {
        router.replace(ROTA_ESCOLHA);
      }
    }
    verificar();
  }, [pathname, naPaginaDeEscolha, router]);

  if (sessao === undefined) return null; // ainda lendo o localStorage
  if (!sessao && !naPaginaDeEscolha) return null; // redirecionando

  return (
    <div className="flex flex-col gap-4">
      {sessao && !naPaginaDeEscolha && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-sunken px-3 py-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-faint">Validando</p>
            <p className="font-medium text-ink">
              {sessao.title} · {sessao.venue} · {formatarData(sessao.startsAt)}
            </p>
          </div>
          <Link href={ROTA_ESCOLHA} className="shrink-0 font-medium text-accent hover:underline">
            Trocar sessão
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}
