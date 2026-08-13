import { generateSeats, MAX_ROWS, MAX_SEATS_PER_ROW } from './seat-layout';

describe('generateSeats', () => {
  it('gera fileiras por letra e assentos comecando em 1', () => {
    const seats = generateSeats(2, 3);

    expect(seats).toEqual([
      { row: 'A', number: 1 },
      { row: 'A', number: 2 },
      { row: 'A', number: 3 },
      { row: 'B', number: 1 },
      { row: 'B', number: 2 },
      { row: 'B', number: 3 },
    ]);
  });

  it('gera exatamente fileiras x assentos por fileira', () => {
    expect(generateSeats(8, 12)).toHaveLength(96);
  });

  it('nao gera assento duplicado', () => {
    const chaves = generateSeats(MAX_ROWS, 10).map(
      (s) => `${s.row}${s.number}`,
    );
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it.each([
    [0, 10],
    [MAX_ROWS + 1, 10],
    [5, 0],
    [5, MAX_SEATS_PER_ROW + 1],
    [1.5, 10],
  ])('recusa layout invalido (%i x %i)', (rows, seatsPerRow) => {
    expect(() => generateSeats(rows, seatsPerRow)).toThrow(/Layout invalido/);
  });
});
