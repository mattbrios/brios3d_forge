import type { Request } from 'express';
import type { UserRole } from '../users/entities/user.entity.js';

// Contrato do usuário autenticado (door 6): o mesmo em /auth/login e /auth/me.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

export const INVALID_CREDENTIALS = 'E-mail ou senha inválidos';
export const SESSION_REQUIRED = 'Sessão expirada ou inexistente. Entre novamente';
export const TOO_MANY_ATTEMPTS = 'Muitas tentativas de login. Tente novamente em 15 minutos';
