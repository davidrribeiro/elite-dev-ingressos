import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './auth.types';

/**
 * Injeta o usuario que o JwtAuthGuard anexou ao request.
 *
 * So use em rota protegida: em rota publica o valor e undefined, porque nao
 * houve token para validar.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
