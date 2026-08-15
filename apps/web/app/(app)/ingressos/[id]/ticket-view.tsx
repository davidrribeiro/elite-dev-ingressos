'use client';

import { useEffect, useState } from 'react';
import { QrCode } from '@/components/qr-code';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api-error';
import { formatarData } from '@/lib/money';
import { formatarCodigoIngresso } from '@/lib/ticket-code';
import type { TicketDetail } from '@/lib/types';

export function TicketView({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;

    api
      .get<TicketDetail>(`/tickets/${ticketId}`)
      .then((dados) => {
        if (ativo) setTicket(dados);
      })
      .catch((causa: unknown) => {
        if (ativo) {
          setErro(isApiError(causa) ? causa.message : 'Nao foi possivel carregar o ingresso.');
        }
      });

    return () => {
      ativo = false;
    };
  }, [ticketId]);

  async function copiarLink() {
    if (!ticket) return;
    const url = `${window.location.origin}/i/${ticket.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (erro) {
    return <Alert tone="danger">{erro}</Alert>;
  }

  if (!ticket) {
    return <p className="text-muted">Carregando...</p>;
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardBody className="flex flex-col items-center gap-4 text-center">
        <Badge tone={ticket.usedAt ? 'neutral' : 'ok'}>
          {ticket.usedAt ? `Usado em ${formatarData(ticket.usedAt)}` : 'Valido'}
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

        <QrCode value={ticket.code} />
        <p className="font-mono tracking-wider text-muted">
          {formatarCodigoIngresso(ticket.code)}
        </p>

        <Button variant="secondary" onClick={copiarLink} className="w-full">
          {copiado ? 'Link copiado!' : 'Copiar link de compartilhamento'}
        </Button>

        {/* FR-028: a compra e definitiva, e a tela precisa dizer isso com
            todas as letras — nao deixar o cliente procurando um botao de
            cancelar que nao existe. */}
        <Alert tone="info" className="text-left">
          Esta compra e definitiva. Ingressos emitidos nao podem ser
          cancelados, estornados ou transferidos.
        </Alert>
      </CardBody>
    </Card>
  );
}
