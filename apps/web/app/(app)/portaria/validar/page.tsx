'use client';

import { FormEvent, useCallback, useState } from 'react';
import { GateResult } from '@/components/gate-result';
import { QrScanner } from '@/components/qr-scanner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api';
import { isApiError } from '@/lib/api-error';
import { lerSessaoPortaria } from '@/lib/gate-session';
import type { GateValidateResult } from '@/lib/types';

/** XXXX-XXXX-XXXX-XXXX enquanto digita. A normalizacao de verdade (I/L/O) e no servidor. */
function mascarar(valor: string): string {
  const limpo = valor.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 16);
  return limpo.match(/.{1,4}/g)?.join('-') ?? limpo;
}

export default function ValidarIngressoPage() {
  const [codigoManual, setCodigoManual] = useState('');
  const [resultado, setResultado] = useState<GateValidateResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);

  // A camera guarda o layout ja garantiu que existe: sem sessao, nem chega
  // a renderizar esta pagina.
  const sessao = lerSessaoPortaria()!;

  const validar = useCallback(
    async (code: string) => {
      if (validando) return; // evita disparo duplo da mesma leitura de camera
      setValidando(true);
      setErro(null);

      try {
        const resposta = await api.post<GateValidateResult>('/gate/validate', {
          code,
          eventId: sessao.id,
        });
        setResultado(resposta);
      } catch (causa) {
        setErro(isApiError(causa) ? causa.message : 'Nao foi possivel validar o ingresso.');
      } finally {
        setValidando(false);
      }
    },
    [sessao.id, validando],
  );

  function enviarManual(evento: FormEvent) {
    evento.preventDefault();
    if (!codigoManual) return;
    void validar(codigoManual);
  }

  function lerOutro() {
    setResultado(null);
    setErro(null);
    setCodigoManual('');
  }

  return (
    <div className="flex flex-col gap-6">
      {resultado ? (
        <div className="flex flex-col gap-4">
          <GateResult resultado={resultado} />
          <Button size="lg" onClick={lerOutro}>
            Ler outro ingresso
          </Button>
        </div>
      ) : (
        <>
          {erro && <Alert tone="danger">{erro}</Alert>}

          <QrScanner ativo={!resultado} onLeitura={(texto) => void validar(texto)} />

          <form onSubmit={enviarManual} className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label="Ou digite o código"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                inputMode="text"
                autoCapitalize="characters"
                value={codigoManual}
                onChange={(e) => setCodigoManual(mascarar(e.target.value))}
              />
            </div>
            <Button type="submit" loading={validando} disabled={!codigoManual}>
              Validar
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
