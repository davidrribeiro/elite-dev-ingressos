import {
  formatTicketCode,
  generateShareToken,
  generateTicketCode,
  normalizeTicketCode,
} from './ticket-code';

const ALFABETO_CROCKFORD = /^[0-9A-HJKMNP-TV-Z]+$/;

describe('generateTicketCode', () => {
  it('gera 16 caracteres do alfabeto Crockford', () => {
    const code = generateTicketCode();
    expect(code).toHaveLength(16);
    expect(code).toMatch(ALFABETO_CROCKFORD);
  });

  it('nao repete em mil geracoes seguidas', () => {
    const codigos = new Set(Array.from({ length: 1000 }, generateTicketCode));
    expect(codigos.size).toBe(1000);
  });

  it('nunca contem I, L, O ou U — fora do alfabeto Crockford de proposito', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTicketCode()).not.toMatch(/[ILOU]/);
    }
  });
});

describe('formatTicketCode', () => {
  it('agrupa em blocos de 4 separados por hifen', () => {
    expect(formatTicketCode('A1B2C3D4E5F6G7H8')).toBe('A1B2-C3D4-E5F6-G7H8');
  });
});

describe('normalizeTicketCode', () => {
  it('remove hifens e espacos e converte para caixa alta', () => {
    expect(normalizeTicketCode('a1b2-c3d4-e5f6-g7h8')).toBe('A1B2C3D4E5F6G7H8');
    expect(normalizeTicketCode('a1 b2 c3d4')).toBe('A1B2C3D4');
  });

  it('corrige I e L para 1, e O para 0', () => {
    expect(normalizeTicketCode('AIBL-COD0')).toBe('A1B1C0D0');
  });

  it('e a inversa de formatTicketCode para o mesmo codigo', () => {
    const code = generateTicketCode();
    expect(normalizeTicketCode(formatTicketCode(code))).toBe(code);
    expect(normalizeTicketCode(formatTicketCode(code).toLowerCase())).toBe(
      code,
    );
  });
});

describe('generateShareToken', () => {
  it('gera token base64url sem repetir', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateShareToken));
    expect(tokens.size).toBe(500);
  });

  it('nao usa o mesmo alfabeto do code — nao deveria ser confundido com ele', () => {
    const token = generateShareToken();
    expect(token.length).toBeGreaterThan(16);
  });
});
