'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireRole } from '@/components/require-role';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api-error';
import { formatarData } from '@/lib/money';
import type { TicketSummary } from '@/lib/types';

/**
 * Client component: ingresso e dado do dono, autenticado por token no
 * localStorage — um Server Component nao teria como le-lo.
 */
export default function MeusIngressosPage() {
  return (
    <RequireRole role="CUSTOMER">
      <ListaDeIngressos />
    </RequireRole>
  );
}

function ListaDeIngressos() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    api
      .get<TicketSummary[]>('/me/tickets')
      .then((dados) => {
        if (ativo) setTickets(dados);
      })
      .catch((causa: unknown) => {
        if (ativo) {
          setErro(isApiError(causa) ? causa.message : 'Nao foi possivel carregar seus ingressos.');
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Meus ingressos</h1>

      {erro && <Alert tone="danger">{erro}</Alert>}

      {!erro && !tickets && <p className="text-muted">Carregando...</p>}

      {tickets && tickets.length === 0 && (
        <p className="text-muted">
          Voce ainda nao tem ingressos.{' '}
          <Link href="/" className="font-medium text-accent hover:underline">
            Ver sessoes
          </Link>
          .
        </p>
      )}

      {tickets && tickets.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/ingressos/${ticket.id}`}
              className="group overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent"
            >
              <div className="relative aspect-2/3 overflow-hidden bg-surface-sunken">
                {ticket.event.posterUrl ? (
                  <Image
                    src={ticket.event.posterUrl}
                    alt={ticket.event.title}
                    width={200}
                    height={300}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-faint">
                    Sem poster
                  </div>
                )}
                <Badge
                  tone={ticket.usedAt ? 'neutral' : 'ok'}
                  className="absolute right-2 top-2"
                >
                  {ticket.usedAt ? 'Usado' : 'Valido'}
                </Badge>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="truncate font-medium text-ink group-hover:text-accent">
                  {ticket.event.title}
                </p>
                <p className="truncate text-muted">
                  {formatarData(ticket.event.startsAt)} · {ticket.seat.row}
                  {ticket.seat.number}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
