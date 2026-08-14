import { randomBytes } from 'node:crypto';

/**
 * Codigo do ingresso: conteudo do QR e o que a portaria digita a mao quando a
 * camera falha.
 *
 * Base32 Crockford, nao base64url: o codigo tem dois consumidores com
 * necessidades opostas. O QR nao se importa com o formato; a digitacao manual
 * se importa muito, e e requisito explicito do enunciado, nao plano B
 * decorativo. Crockford existe exatamente para isso — sem caracteres
 * ambiguos (fora do alfabeto: I, L, O, U), indiferente a caixa.
 *
 * 80 bits de `randomBytes(10)` codificam em exatamente 16 simbolos (80 / 5).
 * Ver specs/001-decisoes-em-aberto/research.md R4.
 */
const ALFABETO_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateTicketCode(): string {
  return encodeCrockford(randomBytes(10));
}

/** "A1B2C3D4E5F6G7H8" -> "A1B2-C3D4-E5F6-G7H8", para exibir ou imprimir. */
export function formatTicketCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

/**
 * Normaliza entrada do usuario — camera ou digitacao manual — para o formato
 * armazenado: caixa alta, sem hifen nem espaco, com os erros classicos de
 * transcricao corrigidos. `I` e `L` parecem `1`; `O` parece `0` — o Crockford
 * exclui esses quatro simbolos do alfabeto de proposito, e a normalizacao
 * fecha o ciclo aceitando o que a pessoa provavelmente quis dizer.
 */
export function normalizeTicketCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
}

/**
 * Token do link publico de compartilhamento. Campo separado do `code` — quem
 * recebe o link ve o ingresso, mas nao consegue passar na portaria com ele.
 * Ninguem digita um link a mao, entao base64url (mais denso) e suficiente
 * aqui, sem a preocupacao de ambiguidade visual do `code`.
 */
export function generateShareToken(): string {
  return randomBytes(16).toString('base64url');
}

/** Codifica bytes em Crockford, 5 bits por simbolo, sem padding a mais. */
function encodeCrockford(buffer: Buffer): string {
  let bitBuffer = 0;
  let bitCount = 0;
  let output = '';

  for (const byte of buffer) {
    bitBuffer = (bitBuffer << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      const shift = bitCount - 5;
      output += ALFABETO_CROCKFORD[(bitBuffer >>> shift) & 0x1f];
      bitCount -= 5;
      bitBuffer &= (1 << bitCount) - 1;
    }
  }

  if (bitCount > 0) {
    output += ALFABETO_CROCKFORD[(bitBuffer << (5 - bitCount)) & 0x1f];
  }

  return output;
}
