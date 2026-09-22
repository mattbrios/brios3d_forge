import type { Request } from 'express';
import type { UserRole } from '../users/entities/user.entity.js';

// Contrato do usuário autenticado (door 6): o mesmo em /auth/login e /auth/me.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// sessionId identifica a sessão da própria requisição (ex.: para uma troca de senha não
// encerrar a sessão que a fez).
export type AuthenticatedRequest = Request & { user?: AuthUser; sessionId?: string };

export const INVALID_CREDENTIALS = 'E-mail ou senha inválidos';
export const SESSION_REQUIRED = 'Sessão expirada ou inexistente. Entre novamente';
export const TOO_MANY_ATTEMPTS = 'Muitas tentativas de login. Tente novamente em 15 minutos';
export const PERMISSION_DENIED = 'Você não tem permissão para esta ação';
export const WRONG_CURRENT_PASSWORD = 'Senha atual incorreta';
