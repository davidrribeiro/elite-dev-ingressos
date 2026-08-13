import { Role } from '@prisma/client';

/** Conteudo do JWT. `sub` e o id do usuario, por convencao. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/** Usuario da requisicao autenticada, injetado por @CurrentUser(). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

/** Usuario devolvido ao cliente. Nunca inclui o hash da senha. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
