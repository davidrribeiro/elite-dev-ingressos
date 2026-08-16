'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api-error';
import { salvarSessaoPortaria } from '@/lib/gate-session';
import { formatarData } from '@/lib/money';
import type { GateEventsResponse, GateEventSummary } from '@/lib/types';

export default function EscolhaDeSessaoPage() {
  const router = useRouter();
  const [dados, setDados] = useState<GateEventsResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    api
      .get<GateEventsResponse>('/gate/events')
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((causa: unknown) => {
        if (ativo) {
          setErro(isApiError(causa) ? causa.message : 'Nao foi possivel carregar as sessoes.');
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  function escolher(evento: GateEventSummary) {
    salvarSessaoPortaria({
      id: evento.id,
      title: evento.title,
      venue: evento.venue,
      startsAt: evento.startsAt,
    });
    router.push('/portaria/validar');
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Qual sessão você está validando?
      </h1>

      {erro && <Alert tone="danger">{erro}</Alert>}

      {!erro && !dados && <p className="text-muted">Carregando...</p>}

      {dados && dados.today.length === 0 && dados.upcoming.length === 0 && (
        <p className="text-muted">Nenhuma sessão publicada no momento.</p>
      )}

      {dados && dados.today.length > 0 && (
        <Secao titulo="Hoje" eventos={dados.today} onEscolher={escolher} />
      )}

      {dados && dados.upcoming.length > 0 && (
        <Secao titulo="Próximas" eventos={dados.upcoming} onEscolher={escolher} />
      )}
    </div>
  );
}

function Secao({
  titulo,
  eventos,
  onEscolher,
}: {
  titulo: string;
  eventos: GateEventSummary[];
  onEscolher: (evento: GateEventSummary) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-faint">{titulo}</h2>
      <div className="flex flex-col gap-2">
        {eventos.map((evento) => (
          <button key={evento.id} type="button" onClick={() => onEscolher(evento)} className="text-left">
            <Card className="transition-colors hover:border-accent">
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{evento.title}</p>
                  <p className="text-muted">
                    {evento.venue} · {formatarData(evento.startsAt)}
                  </p>
                </div>
                <Badge tone="neutral">
                  {evento.ticketsUsed}/{evento.ticketsIssued} entraram
                </Badge>
              </CardBody>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
