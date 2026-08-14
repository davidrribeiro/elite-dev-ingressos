'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ErrorCode, isApiError } from '@/lib/api-error';
import { formatarCentavos } from '@/lib/money';
import { useSession } from '@/lib/session';
import type { Seat } from '@/lib/types';

const MAX_ASSENTOS = 6;

/**
 * Mapa de assentos. A tela mais olhada do projeto: e onde a garantia central
 * do desafio — assento nao vendido duas vezes — fica visivel para quem usa.
 */
export function SeatMap({
  eventId,
  seats: seatsIniciais,
  priceCents,
}: {
  eventId: string;
  seats: Seat[];
  priceCents: number;
}) {
  const router = useRouter();
  const { user } = useSession();

  const [seats, setSeats] = useState(seatsIniciais);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [conflito, setConflito] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fileiras = useMemo(() => agruparPorFileira(seats), [seats]);

  function alternar(seat: Seat) {
    if (seat.status !== 'AVAILABLE') return;

    setConflito((atual) => {
      if (!atual.has(seat.id)) return atual;
      const proximo = new Set(atual);
      proximo.delete(seat.id);
      return proximo;
    });

    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(seat.id)) {
        proximo.delete(seat.id);
      } else if (proximo.size < MAX_ASSENTOS) {
        proximo.add(seat.id);
      }
      return proximo;
    });
  }

  async function reservar() {
    if (!user) {
      router.push('/entrar');
      return;
    }

    setErro(null);
    setEnviando(true);

    try {
      const reserva = await api.post<{ id: string }>('/reservations', {
        eventId,
        seatIds: Array.from(selecionados),
      });
      router.push(`/checkout/${reserva.id}`);
    } catch (causa) {
      setEnviando(false);

      if (isApiError(causa) && causa.is(ErrorCode.SEATS_TAKEN)) {
        const tomados = new Set(causa.seatIds);

        // So os assentos em conflito saem da selecao — os demais continuam
        // escolhidos, para o cliente nao ter que remontar o pedido do zero.
        setSelecionados((atual) => {
          const proximo = new Set(atual);
          tomados.forEach((id) => proximo.delete(id));
          return proximo;
        });
        setConflito(tomados);
        setSeats((atual) =>
          atual.map((s) => (tomados.has(s.id) ? { ...s, status: 'TAKEN' } : s)),
        );
        setErro(causa.message);
        return;
      }

      setErro(isApiError(causa) ? causa.message : 'Nao foi possivel reservar.');
    }
  }

  const total = selecionados.size * priceCents;

  return (
    <div className="flex flex-col gap-4">
      {erro && <Alert tone="danger">{erro}</Alert>}

      {user && user.role !== 'CUSTOMER' && (
        <Alert tone="info">
          Esta conta e de {user.role === 'ORGANIZER' ? 'organizador' : 'portaria'}.
          Entre com uma conta de cliente para reservar.
        </Alert>
      )}

      <div className="rounded-lg border border-line bg-surface p-4">
        {/* Referencia espacial da sala: sem ela, "fileira A" nao significa
            nada — e o mapa e onde essa orientacao precisa existir. */}
        <div className="mx-auto mb-6 h-1.5 w-2/3 rounded-full bg-line-strong" />
        <p className="mb-4 text-center text-xs uppercase tracking-widest text-faint">
          Tela
        </p>

        {/* overflow-x-auto: em telas estreitas o mapa rola na horizontal em
            vez de encolher os assentos ate ficarem inclicaveis. */}
        <div className="overflow-x-auto">
          <div className="flex min-w-max flex-col items-center gap-1.5 px-2">
            {fileiras.map(([fileira, assentos]) => (
              <div key={fileira} className="flex items-center gap-1.5">
                <span className="w-4 text-xs font-medium text-faint">
                  {fileira}
                </span>
                {assentos.map((seat) => (
                  <SeatButton
                    key={seat.id}
                    seat={seat}
                    selecionado={selecionados.has(seat.id)}
                    conflito={conflito.has(seat.id)}
                    onClick={() => alternar(seat)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <Legenda />
      </div>

      {selecionados.size > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_4px_16px_rgb(0_0_0_/_0.08)]">
          <div>
            <p className="font-medium text-ink">
              {selecionados.size}{' '}
              {selecionados.size === 1 ? 'assento' : 'assentos'}
            </p>
            <p className="text-muted">{formatarCentavos(total)}</p>
          </div>
          <Button
            size="lg"
            loading={enviando}
            disabled={user !== null && user.role !== 'CUSTOMER'}
            onClick={reservar}
          >
            Reservar
          </Button>
        </div>
      )}
    </div>
  );
}

function SeatButton({
  seat,
  selecionado,
  conflito,
  onClick,
}: {
  seat: Seat;
  selecionado: boolean;
  conflito: boolean;
  onClick: () => void;
}) {
  const ocupado = seat.status === 'TAKEN';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      aria-label={`Poltrona ${seat.row}${seat.number}, ${rotuloDoEstado(seat, selecionado)}`}
      aria-pressed={selecionado}
      title={`${seat.row}${seat.number}`}
      className={[
        'flex size-7 shrink-0 items-center justify-center rounded-sm border text-[10px] font-medium transition-colors',
        selecionado
          ? 'border-seat-picked bg-seat-picked text-white'
          : ocupado
            ? 'cursor-not-allowed border-line bg-seat-taken text-faint'
            : 'border-line-strong bg-seat-free text-muted hover:border-accent hover:text-accent',
        conflito && 'animate-pulse ring-2 ring-danger',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {seat.number}
    </button>
  );
}

function rotuloDoEstado(seat: Seat, selecionado: boolean): string {
  if (selecionado) return 'selecionada';
  return seat.status === 'TAKEN' ? 'ocupada' : 'livre';
}

function Legenda() {
  const itens: { cor: string; rotulo: string }[] = [
    { cor: 'bg-seat-free border border-line-strong', rotulo: 'Livre' },
    { cor: 'bg-seat-picked', rotulo: 'Selecionada' },
    { cor: 'bg-seat-taken', rotulo: 'Ocupada' },
  ];

  return (
    <div className="mt-6 flex items-center justify-center gap-5">
      {itens.map((item) => (
        <div key={item.rotulo} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-sm ${item.cor}`} />
          <span className="text-xs text-muted">{item.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

function agruparPorFileira(seats: Seat[]): [string, Seat[]][] {
  const porFileira = new Map<string, Seat[]>();

  for (const seat of seats) {
    const lista = porFileira.get(seat.row) ?? [];
    lista.push(seat);
    porFileira.set(seat.row, lista);
  }

  return Array.from(porFileira.entries()).sort(([a], [b]) => a.localeCompare(b));
}
