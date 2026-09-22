import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';

// Id da sessão que fez a requisição, posto pelo AuthGuard. Só vale em rotas protegidas.
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().sessionId,
);
