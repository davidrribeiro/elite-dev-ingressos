/**
 * Formatos devolvidos pela API.
 *
 * Escritos a mao em vez de gerados: o contrato e pequeno e estavel, e um
 * gerador traria uma etapa de build para economizar cem linhas. Se crescer
 * muito, vale reconsiderar.
 *
 * Fonte: docs/contrato-api.md e specs/001-decisoes-em-aberto/contracts/.
 */

export type Role = 'ORGANIZER' | 'CUSTOMER' | 'GATE';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export type SeatStatus = 'AVAILABLE' | 'TAKEN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EventSummary {
  id: string;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  venue: string;
  startsAt: string;
  priceCents: number;
  status: EventStatus;
  totalSeats: number;
}

export interface EventListResponse {
  /** Instante do servidor, para corrigir o desvio do relogio do cliente. */
  serverNow: string;
  events: EventSummary[];
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
}

export interface EventDetail {
  id: string;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  venue: string;
  startsAt: string;
  priceCents: number;
  status: EventStatus;
  serverNow: string;
  seats: Seat[];
}

export interface OrganizerEvent extends EventSummary {
  createdAt: string;
  ticketsIssued: number;
}

export type ReservationStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface ReservationSeatSummary {
  id: string;
  row: string;
  number: number;
}

export interface LastPayment {
  status: 'APPROVED' | 'DECLINED';
  declineReason: string | null;
}

export interface ReservationDetail {
  id: string;
  status: ReservationStatus;
  totalCents: number;
  expiresAt: string;
  serverNow: string;
  event: { id: string; title: string; venue: string; startsAt: string };
  seats: ReservationSeatSummary[];
  lastPayment: LastPayment | null;
  ticketIds: string[];
}

interface TicketEventSummary {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  posterUrl: string | null;
}

interface TicketSeatSummary {
  row: string;
  number: number;
}

export interface TicketSummary {
  id: string;
  usedAt: string | null;
  event: TicketEventSummary;
  seat: TicketSeatSummary;
}

/** So o dono ve isto — carrega o `code` que abre a portaria. */
export interface TicketDetail extends TicketSummary {
  code: string;
  shareToken: string;
}

/** Vista publica do link compartilhado. Sem `code`, com o nome do titular. */
export interface PublicTicket {
  id: string;
  usedAt: string | null;
  holder: string;
  event: Omit<TicketEventSummary, 'id'>;
  seat: TicketSeatSummary;
}

export interface GateEventSummary {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  ticketsIssued: number;
  ticketsUsed: number;
}

export interface GateEventsResponse {
  today: GateEventSummary[];
  upcoming: GateEventSummary[];
}

export type GateValidateResult =
  | {
      result: 'VALID';
      ticket: { title: string; startsAt: string; seat: string; holder: string };
    }
  | {
      result: 'ALREADY_USED';
      usedAt: string;
      ticket: { seat: string; holder: string };
    }
  | {
      result: 'WRONG_EVENT';
      belongsTo: { title: string; venue: string; startsAt: string };
    }
  | { result: 'INVALID' };

export interface CatalogMovie {
  tmdbId: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
}
