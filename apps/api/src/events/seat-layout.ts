/** Um assento a ser criado, antes de existir no banco. */
export interface SeatDraft {
  row: string;
  number: number;
}

export const MAX_ROWS = 26; // A..Z — alem disso a nomeacao deixaria de ser obvia
export const MAX_SEATS_PER_ROW = 40;

/**
 * Gera os assentos de uma sala a partir do layout escolhido pelo organizador.
 *
 * Funcao pura, sem banco e sem Nest: e chamada tanto pela criacao de evento
 * quanto pelo seed. Duplicar essa logica nos dois lugares seria a forma mais
 * facil de o seed produzir uma sala que o sistema nao sabe montar.
 *
 * Fileiras sao letras (A, B, C...) e assentos sao numeros comecando em 1, que e
 * como as salas de cinema de verdade nomeiam os lugares.
 */
export function generateSeats(rows: number, seatsPerRow: number): SeatDraft[] {
  if (!Number.isInteger(rows) || !Number.isInteger(seatsPerRow)) {
    throw new Error('Layout invalido: fileiras e assentos precisam ser inteiros.');
  }

  if (rows < 1 || rows > MAX_ROWS) {
    throw new Error(`Layout invalido: use de 1 a ${MAX_ROWS} fileiras.`);
  }

  if (seatsPerRow < 1 || seatsPerRow > MAX_SEATS_PER_ROW) {
    throw new Error(
      `Layout invalido: use de 1 a ${MAX_SEATS_PER_ROW} assentos por fileira.`,
    );
  }

  const seats: SeatDraft[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const row = String.fromCharCode(65 + rowIndex);
    for (let number = 1; number <= seatsPerRow; number++) {
      seats.push({ row, number });
    }
  }

  return seats;
}
