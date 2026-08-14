'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api-error';
import { formatarCentavos } from '@/lib/money';

interface PaymentApproved {
  status: 'APPROVED';
  reservationId: string;
  tickets: { id: string; seat: { row: string; number: number } }[];
}

interface PaymentDeclined {
  status: 'DECLINED';
  declineReason: string;
  expiresAt: string;
  serverNow: string;
}

/**
 * Os quatro cartoes de teste, com o resultado que cada um produz.
 *
 * Visiveis na propria tela (FR-009): o avaliador nao deveria precisar abrir
 * o README para descobrir como provocar uma recusa. Clicar numa linha
 * preenche o formulario — atalho, nao obrigatorio.
 */
const CARTOES_DE_TESTE = [
  { numero: '4242 4242 4242 4242', resultado: 'Aprovado', tom: 'ok' as const },
  { numero: '4000 0000 0000 0002', resultado: 'Saldo insuficiente', tom: 'danger' as const },
  { numero: '4000 0000 0000 0069', resultado: 'Cartao expirado', tom: 'danger' as const },
  { numero: 'Qualquer outro', resultado: 'Nao reconhecido', tom: 'danger' as const },
];

export function PaymentForm({
  reservaId,
  totalCents,
  motivoDaUltimaRecusa,
}: {
  reservaId: string;
  totalCents: number;
  /**
   * Recusa persistida no servidor (`lastPayment`). Cobre o cliente que
   * recarrega a pagina depois de uma recusa: sem isso, o motivo se perderia
   * ao atualizar, e sobraria so o "tente de novo" sem dizer por que a
   * ultima tentativa falhou.
   */
  motivoDaUltimaRecusa?: string | null;
}) {
  const router = useRouter();

  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('12/30');
  const [cvv, setCvv] = useState('123');
  const [enviando, setEnviando] = useState(false);
  const [motivoDaRecusa, setMotivoDaRecusa] = useState(motivoDaUltimaRecusa ?? null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setMotivoDaRecusa(null);
    setEnviando(true);

    try {
      const resultado = await api.post<PaymentApproved | PaymentDeclined>(
        `/reservations/${reservaId}/payment`,
        { cardNumber, holderName, expiry, cvv },
      );

      if (resultado.status === 'APPROVED') {
        // T044: aprovacao leva direto aos ingressos emitidos.
        router.push('/ingressos');
        router.refresh();
        return;
      }

      // T043: recusa fica na mesma tela, motivo em destaque, assentos e
      // contador intocados — so troca de cartao e tenta de novo.
      setMotivoDaRecusa(resultado.declineReason);
    } catch (causa) {
      setErro(isApiError(causa) ? causa.message : 'Nao foi possivel processar o pagamento.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-line bg-surface-sunken p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          Cartoes de teste — nenhum dado real e cobrado
        </p>
        <div className="flex flex-col gap-1">
          {CARTOES_DE_TESTE.map((cartao) => (
            <button
              key={cartao.numero}
              type="button"
              onClick={() =>
                cartao.numero !== 'Qualquer outro' && setCardNumber(cartao.numero)
              }
              className="flex items-center justify-between rounded-sm px-1.5 py-1 text-left hover:bg-surface"
            >
              <span className="font-mono text-ink">{cartao.numero}</span>
              <span className={cartao.tom === 'ok' ? 'text-ok' : 'text-danger'}>
                {cartao.resultado}
              </span>
            </button>
          ))}
        </div>
      </div>

      {motivoDaRecusa && (
        <Alert tone="danger" title="Pagamento recusado">
          {motivoDaRecusa}. Sua reserva continua ativa — tente outro cartao.
        </Alert>
      )}

      {erro && <Alert tone="danger">{erro}</Alert>}

      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <Field
          label="Numero do cartao"
          inputMode="numeric"
          placeholder="4242 4242 4242 4242"
          required
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <Field
              label="Nome no cartao"
              hint="Decorativo — nao influencia o resultado."
              required
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
            />
          </div>
          <Field
            label="Validade"
            placeholder="MM/AA"
            required
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
          <Field
            label="CVV"
            inputMode="numeric"
            required
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
          />
        </div>

        <Button type="submit" size="lg" loading={enviando}>
          Pagar {formatarCentavos(totalCents)}
        </Button>
      </form>
    </div>
  );
}
