import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SeatMap } from '@/components/seat-map';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { formatarCentavos, formatarData } from '@/lib/money';
import type { EventDetail } from '@/lib/types';

// Nunca estatico: o mapa de assentos muda a cada reserva ou expiracao.
export const dynamic = 'force-dynamic';

/**
 * Server Component: a leitura do evento e publica e nao muda por usuario, faz
 * sentido vir renderizada do servidor. A interatividade do mapa (selecionar
 * assento, reservar) mora no SeatMap, que e client component.
 */
export default async function EventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let event: EventDetail;
  try {
    event = await api.get<EventDetail>(`/events/${id}`, undefined, {
      cache: 'no-store', // mapa de assentos nunca e servido de cache
    });
  } catch (causa) {
    if (causa instanceof ApiError && causa.status === 404) notFound();
    throw causa;
  }

  const disponiveis = event.seats.filter((s) => s.status === 'AVAILABLE').length;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="lg:w-72 lg:shrink-0">
        <div className="overflow-hidden rounded-lg border border-line bg-surface-sunken">
          {event.posterUrl ? (
            <Image
              src={event.posterUrl}
              alt={event.title}
              width={342}
              height={513}
              className="h-auto w-full"
              priority
            />
          ) : (
            <div className="flex aspect-2/3 items-center justify-center text-faint">
              Sem poster
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <h1 className="text-lg font-semibold text-ink">{event.title}</h1>
          {event.overview && (
            <p className="text-muted">{event.overview}</p>
          )}

          <dl className="mt-2 flex flex-col gap-1 text-muted">
            <div className="flex justify-between">
              <dt>Sessao</dt>
              <dd className="text-ink">{formatarData(event.startsAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Local</dt>
              <dd className="text-ink">{event.venue}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Preco</dt>
              <dd className="text-ink">{formatarCentavos(event.priceCents)}</dd>
            </div>
          </dl>

          <Badge tone={disponiveis > 0 ? 'ok' : 'danger'} className="mt-1 w-fit">
            {disponiveis > 0 ? `${disponiveis} lugares livres` : 'Esgotado'}
          </Badge>
        </div>
      </div>

      <div className="flex-1">
        <SeatMap
          eventId={event.id}
          seats={event.seats}
          priceCents={event.priceCents}
        />
      </div>
    </div>
  );
}
