/**
 * Espelha `apps/api/src/tickets/ticket-code.ts#formatTicketCode`.
 *
 * Duplicado de proposito, nao por descuido: front e API sao dois deploys
 * separados, sem pacote compartilhado no monorepo. Duas linhas de formatacao
 * nao justificam a complexidade de um pacote so para isso.
 */
export function formatarCodigoIngresso(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}
