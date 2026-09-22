import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

// Usuário que o AuthGuard pôs na requisição. Só vale em rotas protegidas.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
