'use client';

import { useEffect, useMemo, useState } from 'react';

export interface Countdown {
  totalSeconds: number;
  minutes: number;
  seconds: number;
  /** Rotulo pronto, "09:58". */
  label: string;
  expired: boolean;
}

/**
 * Tempo restante ate `expiresAt`, corrigido pelo desvio do relogio do
 * navegador.
 *
 * O desvio e lido dentro do efeito, nunca no corpo do componente: chamar
 * `Date.now()` durante a renderizacao quebra a pureza que o React exige (a
 * funcao de render pode rodar mais de uma vez por commit). O efeito e o lugar
 * sancionado para ler relogio, rede ou qualquer estado externo ao React. Uma
 * vez lido, o desvio fica fixo pelo tempo de vida do componente e e
 * reaplicado a cada segundo — nunca recalculado, ou o problema que ele
 * resolve voltaria a existir. Ver research.md R8.
 *
 * Quem decide se a reserva ainda vale e sempre o servidor, no momento do
 * pagamento — este contador e so informativo (constituicao, principio II).
 */
export function useCountdown(expiresAt: string, serverNow: string): Countdown {
  const alvo = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const referencia = useMemo(() => new Date(serverNow).getTime(), [serverNow]);

  // Ate o efeito medir o desvio de verdade, assume desvio zero — aproximacao
  // valida so pelo instante entre o primeiro paint e a primeira medicao.
  const [totalSeconds, setTotalSeconds] = useState(() =>
    Math.max(0, Math.round((alvo - referencia) / 1000)),
  );

  useEffect(() => {
    function marcar(desvioMs: number) {
      setTotalSeconds(
        Math.max(0, Math.round((alvo - (Date.now() + desvioMs)) / 1000)),
      );
    }

    function iniciar() {
      const desvioMs = referencia - Date.now();
      marcar(desvioMs);
      return setInterval(() => marcar(desvioMs), 1000);
    }

    const id = iniciar();
    return () => clearInterval(id);
  }, [alvo, referencia]);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    minutes,
    seconds,
    label: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    expired: totalSeconds <= 0,
  };
}
