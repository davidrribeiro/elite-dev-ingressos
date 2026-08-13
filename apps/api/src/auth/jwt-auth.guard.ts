import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { AuthenticatedUser, JwtPayload } from './auth.types';

export const IS_PUBLIC = 'isPublic';

/** Marca a rota como acessivel sem token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Le o Bearer, valida a assinatura e anexa o usuario ao request.
 *
 * Sem Passport de proposito: a estrategia JWT do Passport traria duas camadas
 * de indirecao para fazer exatamente estas vinte linhas.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Entre para continuar.', 401);
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      (request as Request & { user?: AuthenticatedUser }).user = user;
      return true;
    } catch {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Sua sessao expirou. Entre novamente.',
        401,
      );
    }
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? value : undefined;
  }
}
