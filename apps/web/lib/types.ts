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

export interface CatalogMovie {
  tmdbId: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
}
