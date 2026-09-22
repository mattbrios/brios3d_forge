import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_DENIED, type AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC } from './public.decorator.js';
import { ROLES } from './roles.decorator.js';

// Guard global (door 1), depois do AuthGuard: uma rota sem @Roles() é só de admin. @Roles(...)
// libera outros papéis, e admin passa sempre, sem precisar ser listado.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.role === 'admin') {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && request.user && roles.includes(request.user.role)) {
      return true;
    }
    throw new ForbiddenException(PERMISSION_DENIED);
  }
}
