/**
 * Gateway de pagamento simulado.
 *
 * Funcao pura: numero de cartao -> resultado. Sem banco, sem Nest, sem
 * efeito colateral — testavel isolada e reusada tanto pelo caminho de
 * aprovacao quanto pelo de recusa em `PaymentsService`.
 *
 * Tabela de decisao: specs/001-decisoes-em-aberto/contracts/payments.md
 */

export type GatewayResult =
  | { status: 'APPROVED' }
  | { status: 'DECLINED'; declineReason: string }
  /** Nao e recusa: o numero nao tem formato de cartao. Nada e cobrado nem registrado. */
  | { status: 'INVALID_FORMAT' };

const CARTAO_APROVADO = '4242424242424242';

const MOTIVOS_DE_RECUSA: Record<string, string> = {
  '4000000000000002': 'Saldo insuficiente',
  '4000000000000069': 'Cartao expirado',
};

const MOTIVO_PADRAO = 'Cartao nao reconhecido pela simulacao';

/**
 * 13 a 19 digitos cobre a faixa real de numero de cartao (Amex tem 15, a
 * maioria tem 16, algumas bandeiras chegam a 19). Espacos e hifens sao
 * removidos antes da checagem — sao como os cartoes de teste sao
 * apresentados na tela, ninguem digita os 16 digitos colados.
 */
const FORMATO_VALIDO = /^\d{13,19}$/;

export function chargeSimulated(cardNumberRaw: string): GatewayResult {
  const numero = cardNumberRaw.replace(/[\s-]/g, '');

  if (!FORMATO_VALIDO.test(numero)) {
    return { status: 'INVALID_FORMAT' };
  }

  if (numero === CARTAO_APROVADO) {
    return { status: 'APPROVED' };
  }

  return {
    status: 'DECLINED',
    declineReason: MOTIVOS_DE_RECUSA[numero] ?? MOTIVO_PADRAO,
  };
}
