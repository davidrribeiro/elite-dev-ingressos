import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { AuthenticatedUser } from './auth.types';

export const ROLES_KEY = 'roles';

/** Restringe a rota aos papeis informados. Roda depois do JwtAuthGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!request.user || !required.includes(request.user.role)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Seu perfil nao tem acesso a esta area.',
        403,
      );
    }

    return true;
  }
}
