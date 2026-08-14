import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatarCentavos, formatarData } from '@/lib/money';
import type { EventListResponse } from '@/lib/types';

// Nunca estatica: disponibilidade de sessao muda a cada reserva, e sem isso
// o Next tentaria pre-renderizar esta pagina em build time, batendo na API
// antes dela sequer estar no ar.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { events } = await api.get<EventListResponse>('/events', undefined, {
    cache: 'no-store', // disponibilidade de assento muda a cada reserva
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Sessoes em cartaz
        </h1>
        <p className="mt-1 text-muted">
          Escolha uma sessao para ver o mapa de assentos.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-muted">Nenhuma sessao publicada no momento.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/eventos/${event.id}`}
              className="group overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent"
            >
              <div className="aspect-2/3 overflow-hidden bg-surface-sunken">
                {event.posterUrl ? (
                  <Image
                    src={event.posterUrl}
                    alt={event.title}
                    width={200}
                    height={300}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-faint">
                    Sem poster
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="truncate font-medium text-ink group-hover:text-accent">
                  {event.title}
                </p>
                <p className="truncate text-muted">{event.venue}</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{formatarData(event.startsAt)}</span>
                  <Badge tone="accent">{formatarCentavos(event.priceCents)}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
