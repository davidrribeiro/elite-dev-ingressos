/**
 * Codigos de erro da API.
 *
 * O front decide pelo `code`, nunca pela `message`. Por isso o codigo e estavel
 * e o texto pode mudar sem quebrar nada do outro lado.
 *
 * Contrato: specs/001-decisoes-em-aberto/contracts/README.md
 */
export const ErrorCode = {
  // Autenticacao e autorizacao
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_USED: 'EMAIL_ALREADY_USED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Genericos
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL: 'INTERNAL',

  // Catalogo externo
  CATALOG_UNAVAILABLE: 'CATALOG_UNAVAILABLE',
  MOVIE_NOT_FOUND: 'MOVIE_NOT_FOUND',

  // Eventos
  EVENT_NOT_PUBLISHED: 'EVENT_NOT_PUBLISHED',
  EVENT_HAS_TICKETS: 'EVENT_HAS_TICKETS',

  // Reserva e pagamento
  SEATS_TAKEN: 'SEATS_TAKEN',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  RESERVATION_NOT_PENDING: 'RESERVATION_NOT_PENDING',
  RESERVATION_ALREADY_PAID: 'RESERVATION_ALREADY_PAID',
  INVALID_CARD_FORMAT: 'INVALID_CARD_FORMAT',

  // Portaria
  GATE_SESSION_REQUIRED: 'GATE_SESSION_REQUIRED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Erro de dominio. Carrega o codigo estavel, o texto para humano e, quando ha
 * algo acionavel, os detalhes que o front usa para reagir — a lista de assentos
 * em conflito, por exemplo.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(what: string) {
    return new AppError(ErrorCode.NOT_FOUND, `${what} nao encontrado.`, 404);
  }

  /**
   * 403 e nao 404 de proposito: o recurso existe, so nao e do requisitante.
   * Fingir que nao existe confunde mais do que protege, num sistema em que o
   * dono ja sabe que o pedido dele existe.
   */
  static forbidden(message = 'Este recurso nao pertence a voce.') {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }
}
