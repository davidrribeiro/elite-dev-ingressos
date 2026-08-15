import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { formatarData } from '@/lib/money';
import type { PublicTicket } from '@/lib/types';

// Nunca estatico: o status "usado" muda quando a portaria valida o ingresso.
export const dynamic = 'force-dynamic';

/**
 * Ingresso compartilhado. Publico, sem autenticacao — e por isso mesmo
 * roda bem como Server Component: nao ha token de navegador para ler.
 *
 * Mostra filme, sessao, local e lugar. Nunca o `code` — a API garante isso
 * pelo `select` da consulta, nao por este componente escolher o que
 * exibir. Mesmo que a resposta um dia trouxesse o campo por engano, esta
 * tela nao o renderiza porque nunca o le da resposta.
 */
export default async function IngressoCompartilhadoPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  let ticket: PublicTicket;
  try {
    ticket = await api.get<PublicTicket>(`/public/tickets/${shareToken}`, undefined, {
      cache: 'no-store',
    });
  } catch (causa) {
    if (causa instanceof ApiError && causa.status === 404) notFound();
    throw causa;
  }

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
        <Badge tone={ticket.usedAt ? 'neutral' : 'ok'}>
          {ticket.usedAt ? 'Ingresso ja utilizado' : 'Ingresso valido'}
        </Badge>

        <div>
          <p className="text-lg font-semibold text-ink">{ticket.event.title}</p>
          <p className="text-muted">{ticket.event.venue}</p>
          <p className="text-muted">{formatarData(ticket.event.startsAt)}</p>
        </div>

        <div className="rounded-md border border-line bg-surface-sunken px-4 py-1.5">
          <span className="font-mono text-ink">
            {ticket.seat.row}
            {ticket.seat.number}
          </span>
        </div>

        <p className="text-muted">
          Ingresso de <span className="font-medium text-ink">{ticket.holder}</span>
        </p>
      </CardBody>
    </Card>
  );
}
