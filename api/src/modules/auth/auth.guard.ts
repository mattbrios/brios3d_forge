import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { SESSION_REQUIRED, type AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC } from './public.decorator.js';
import { readSessionToken } from './session-cookie.js';

// Guard global (AD-015): toda rota exige sessão, exceto as marcadas com @Public().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request.headers.cookie);
    const session = token ? await this.auth.sessionForToken(token) : null;
    if (!session) {
      throw new UnauthorizedException(SESSION_REQUIRED);
    }
    request.user = session.user;
    request.sessionId = session.sessionId;
    return true;
  }
}
