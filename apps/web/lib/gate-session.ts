'use client';

const CHAVE = 'portaria.sessao';

export interface GateSessionSummary {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
}

/**
 * Sessao escolhida pelo operador da portaria, persistida no dispositivo.
 *
 * Por dispositivo, nao por conta no servidor: a mesma conta de portaria pode
 * estar em duas portas ao mesmo tempo, e amarrar a sessao ao usuario no
 * backend quebraria esse caso real. Guarda o objeto inteiro (nao so o id)
 * para o topo da tela mostrar titulo e local sem uma segunda requisicao.
 * Ver research.md R5.
 */
export function salvarSessaoPortaria(sessao: GateSessionSummary) {
  window.localStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function lerSessaoPortaria(): GateSessionSummary | null {
  const bruto = window.localStorage.getItem(CHAVE);
  if (!bruto) return null;

  try {
    return JSON.parse(bruto) as GateSessionSummary;
  } catch {
    return null;
  }
}
