/**
 * Codigos de erro da API. Espelha o enum de `apps/api/src/common/errors`.
 *
 * O front decide por estes valores, nunca pelo texto da mensagem: o texto e
 * escrito para humano e pode mudar sem aviso; o codigo e contrato.
 */
export const ErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_USED: 'EMAIL_ALREADY_USED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL: 'INTERNAL',
  CATALOG_UNAVAILABLE: 'CATALOG_UNAVAILABLE',
  MOVIE_NOT_FOUND: 'MOVIE_NOT_FOUND',
  EVENT_NOT_PUBLISHED: 'EVENT_NOT_PUBLISHED',
  EVENT_HAS_TICKETS: 'EVENT_HAS_TICKETS',
  SEATS_TAKEN: 'SEATS_TAKEN',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  RESERVATION_NOT_PENDING: 'RESERVATION_NOT_PENDING',
  RESERVATION_ALREADY_PAID: 'RESERVATION_ALREADY_PAID',
  INVALID_CARD_FORMAT: 'INVALID_CARD_FORMAT',
  GATE_SESSION_REQUIRED: 'GATE_SESSION_REQUIRED',
  /** Nao vem da API: a requisicao nem chegou la. */
  NETWORK: 'NETWORK',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Formato do envelope devolvido pela API em qualquer falha. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Falha de chamada a API, ja desembrulhada.
 *
 * Existe para a tela poder escrever `if (erro.is(ErrorCode.SEATS_TAKEN))` em
 * vez de cavar `response.status` e reparsear o corpo em cada `catch`.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  is(...codes: (ErrorCode | string)[]): boolean {
    return codes.includes(this.code);
  }

  /** Campos recusados pela validacao, quando o erro for VALIDATION_ERROR. */
  get fields(): string[] {
    const fields = this.details?.fields;
    return Array.isArray(fields) ? (fields as string[]) : [];
  }

  /** Assentos em conflito, quando o erro for SEATS_TAKEN. */
  get seatIds(): string[] {
    const seatIds = this.details?.seatIds;
    return Array.isArray(seatIds) ? (seatIds as string[]) : [];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
