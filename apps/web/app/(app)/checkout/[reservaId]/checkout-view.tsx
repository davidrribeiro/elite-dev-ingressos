'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api-error';
import { useCountdown } from '@/lib/countdown';
import { formatarCentavos, formatarData } from '@/lib/money';
import type { ReservationDetail } from '@/lib/types';
import { PaymentForm } from './payment-form';

/**
 * Client component: a reserva e dado do dono, autenticado por token no
 * localStorage — sem cookie httpOnly, um Server Component nao teria como
 * ler o token. Ver docs/decisoes.md.
 */
export function CheckoutView({ reservaId }: { reservaId: string }) {
  const router = useRouter();
  const [reserva, setReserva] = useState<ReservationDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    let ativo = true;

    api
      .get<ReservationDetail>(`/reservations/${reservaId}`)
      .then((dados) => {
        if (ativo) setReserva(dados);
      })
      .catch((causa: unknown) => {
        if (ativo) {
          setErro(isApiError(causa) ? causa.message : 'Nao foi possivel carregar a reserva.');
        }
      });

    return () => {
      ativo = false;
    };
  }, [reservaId]);

  async function cancelar() {
    setCancelando(true);
    try {
      await api.delete(`/reservations/${reservaId}`);
      router.push(`/eventos/${reserva?.event.id}`);
      router.refresh();
    } catch (causa) {
      setCancelando(false);
      setErro(isApiError(causa) ? causa.message : 'Nao foi possivel cancelar.');
    }
  }

  if (erro && !reserva) {
    return <Alert tone="danger">{erro}</Alert>;
  }

  if (!reserva) {
    return <p className="text-muted">Carregando...</p>;
  }

  if (reserva.status !== 'PENDING') {
    return <ReservaEncerrada reserva={reserva} />;
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader
        title="Confirme sua reserva"
        aside={<Contador reserva={reserva} />}
      />
      <CardBody className="flex flex-col gap-4">
        {erro && <Alert tone="danger">{erro}</Alert>}

        <div>
          <p className="font-medium text-ink">{reserva.event.title}</p>
          <p className="text-muted">{reserva.event.venue}</p>
          <p className="text-muted">{formatarData(reserva.event.startsAt)}</p>
        </div>

        <div className="rounded-md border border-line bg-surface-sunken px-3 py-2">
          <p className="mb-1 text-xs uppercase tracking-wide text-faint">
            {reserva.seats.length === 1 ? 'Poltrona' : 'Poltronas'}
          </p>
          <p className="font-mono text-ink">
            {reserva.seats.map((s) => `${s.row}${s.number}`).join(' · ')}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-muted">Total</span>
          <span className="text-lg font-semibold text-ink">
            {formatarCentavos(reserva.totalCents)}
          </span>
        </div>

        <PaymentForm
          reservaId={reserva.id}
          totalCents={reserva.totalCents}
          motivoDaUltimaRecusa={
            reserva.lastPayment?.status === 'DECLINED'
              ? reserva.lastPayment.declineReason
              : null
          }
        />

        <Button
          variant="ghost"
          size="sm"
          loading={cancelando}
          onClick={cancelar}
        >
          Cancelar reserva
        </Button>
      </CardBody>
    </Card>
  );
}

function Contador({ reserva }: { reserva: ReservationDetail }) {
  const contador = useCountdown(reserva.expiresAt, reserva.serverNow);

  return (
    <Badge tone={contador.expired ? 'danger' : 'warn'}>
      {contador.expired ? 'Expirando...' : contador.label}
    </Badge>
  );
}

function ReservaEncerrada({ reserva }: { reserva: ReservationDetail }) {
  const mensagens: Record<string, { titulo: string; texto: string }> = {
    PAID: {
      titulo: 'Reserva ja paga',
      texto: 'O pagamento desta reserva ja foi confirmado.',
    },
    EXPIRED: {
      titulo: 'Reserva expirada',
      texto: 'O prazo para pagar esta reserva venceu. Escolha os lugares novamente.',
    },
    CANCELLED: {
      titulo: 'Reserva cancelada',
      texto: 'Esta reserva foi cancelada.',
    },
  };

  const info = mensagens[reserva.status] ?? {
    titulo: 'Reserva indisponivel',
    texto: '',
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="font-semibold text-ink">{info.titulo}</p>
        <p className="text-muted">{info.texto}</p>
        <Link
          href={`/eventos/${reserva.event.id}`}
          className="mt-2 font-medium text-accent hover:underline"
        >
          Voltar para a sessao
        </Link>
      </CardBody>
    </Card>
  );
}
