import { formatarData } from '@/lib/money';
import type { GateValidateResult } from '@/lib/types';

/**
 * Os quatro resultados da portaria, legiveis a alguns passos de distancia:
 * cor cheia, simbolo grande, uma palavra. Quem esta na porta le de relance,
 * nao le paragrafo.
 *
 * As quatro cores sao distintas de proposito — VALID e ALREADY_USED nao
 * podem parecer a mesma coisa "de longe", e WRONG_EVENT ganha uma cor
 * propria (nao e falha, e redirecionamento) em vez de reusar o vermelho de
 * INVALID.
 */
export function GateResult({ resultado }: { resultado: GateValidateResult }) {
  switch (resultado.result) {
    case 'VALID':
      return (
        <Banner tom="ok" simbolo="✓" titulo="Válido">
          <Linha>{resultado.ticket.title}</Linha>
          <Linha>{formatarData(resultado.ticket.startsAt)}</Linha>
          <LinhaGrande>{resultado.ticket.seat}</LinhaGrande>
          <Linha>{resultado.ticket.holder}</Linha>
        </Banner>
      );

    case 'ALREADY_USED':
      return (
        <Banner tom="warn" simbolo="↻" titulo="Já utilizado">
          <Linha>Validado {formatarData(resultado.usedAt)}</Linha>
          <LinhaGrande>{resultado.ticket.seat}</LinhaGrande>
          <Linha>{resultado.ticket.holder}</Linha>
        </Banner>
      );

    case 'WRONG_EVENT':
      return (
        <Banner tom="accent" simbolo="→" titulo="Sessão errada">
          <Linha>Este ingresso e de:</Linha>
          <LinhaGrande>{resultado.belongsTo.title}</LinhaGrande>
          <Linha>{resultado.belongsTo.venue}</Linha>
          <Linha>{formatarData(resultado.belongsTo.startsAt)}</Linha>
        </Banner>
      );

    case 'INVALID':
      return (
        <Banner tom="danger" simbolo="✕" titulo="Inválido">
          <Linha>Código não reconhecido.</Linha>
        </Banner>
      );
  }
}

const TONS = {
  ok: 'bg-ok text-white',
  warn: 'bg-warn text-white',
  danger: 'bg-danger text-white',
  accent: 'bg-accent text-white',
} as const;

function Banner({
  tom,
  simbolo,
  titulo,
  children,
}: {
  tom: keyof typeof TONS;
  simbolo: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center gap-2 rounded-lg px-6 py-10 text-center ${TONS[tom]}`}
    >
      <span className="text-6xl leading-none" aria-hidden>
        {simbolo}
      </span>
      <p className="text-2xl font-bold">{titulo}</p>
      <div className="mt-2 flex flex-col gap-0.5 opacity-90">{children}</div>
    </div>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function LinhaGrande({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-3xl font-semibold">{children}</p>;
}
