'use client';

import { useEffect, useState } from 'react';
import { RequireRole } from '@/components/require-role';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { api } from '@/lib/api';
import { ErrorCode, isApiError } from '@/lib/api-error';
import { formatarCentavos, formatarData } from '@/lib/money';
import type { OrganizerEvent } from '@/lib/types';

/**
 * Client component: painel e dado do dono, autenticado por token no
 * localStorage — um Server Component nao teria como le-lo.
 */
export default function PainelDoOrganizadorPage() {
  return (
    <RequireRole role="ORGANIZER">
      <PainelDeSessoes />
    </RequireRole>
  );
}

function PainelDeSessoes() {
  const [eventos, setEventos] = useState<OrganizerEvent[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    api
      .get<OrganizerEvent[]>('/organizer/events')
      .then((dados) => {
        if (ativo) setEventos(dados);
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

  function atualizar(id: string, mudanca: Partial<OrganizerEvent>) {
    setEventos((atual) =>
      atual?.map((e) => (e.id === id ? { ...e, ...mudanca } : e)) ?? atual,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Minhas sessões
      </h1>

      {erro && <Alert tone="danger">{erro}</Alert>}

      {!erro && !eventos && <p className="text-muted">Carregando...</p>}

      {eventos && eventos.length === 0 && (
        <p className="text-muted">
          Você ainda não criou nenhuma sessão. A criação de sessão a partir
          do catálogo é feita via API — veja o README.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {eventos?.map((evento) => (
          <SessaoDoOrganizador
            key={evento.id}
            evento={evento}
            onCancelada={() => atualizar(evento.id, { status: 'CANCELLED' })}
          />
        ))}
      </div>
    </div>
  );
}

function SessaoDoOrganizador({
  evento,
  onCancelada,
}: {
  evento: OrganizerEvent;
  onCancelada: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [bloqueio, setBloqueio] = useState<string | null>(null);

  async function cancelar() {
    setCancelando(true);
    setBloqueio(null);

    try {
      await api.post(`/events/${evento.id}/cancel`);
      onCancelada();
    } catch (causa) {
      if (isApiError(causa) && causa.is(ErrorCode.EVENT_HAS_TICKETS)) {
        setBloqueio(causa.message);
      } else {
        setBloqueio(
          isApiError(causa) ? causa.message : 'Não foi possível cancelar a sessão.',
        );
      }
    } finally {
      setCancelando(false);
      setConfirmando(false);
    }
  }

  const tomDoStatus = { DRAFT: 'neutral', PUBLISHED: 'ok', CANCELLED: 'danger' } as const;
  const rotuloDoStatus = { DRAFT: 'Rascunho', PUBLISHED: 'Publicada', CANCELLED: 'Cancelada' } as const;

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ink">{evento.title}</p>
            <p className="text-muted">
              {evento.venue} · {formatarData(evento.startsAt)}
            </p>
            <p className="text-muted">
              {formatarCentavos(evento.priceCents)} · {evento.ticketsIssued} ingresso
              {evento.ticketsIssued === 1 ? '' : 's'} vendido
              {evento.ticketsIssued === 1 ? '' : 's'}
            </p>
          </div>
          <Badge tone={tomDoStatus[evento.status]}>{rotuloDoStatus[evento.status]}</Badge>
        </div>

        {bloqueio && <Alert tone="danger">{bloqueio}</Alert>}

        {evento.status !== 'CANCELLED' && (
          <div className="flex items-center gap-2">
            {confirmando ? (
              <>
                <span className="text-muted">Cancelar esta sessão?</span>
                <Button
                  variant="danger"
                  size="sm"
                  loading={cancelando}
                  onClick={cancelar}
                >
                  Confirmar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                  Voltar
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
                Cancelar sessão
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
