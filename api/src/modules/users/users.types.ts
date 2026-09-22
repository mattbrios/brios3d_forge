import type { User, UserRole } from './entities/user.entity.js';

// Contrato do usuário na administração (door 2): igual ao AuthUser da Fase 3, mais `active`.
// password_hash e as datas nunca saem.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
}

export const DUPLICATE_EMAIL = 'Já existe um usuário com este e-mail';
export const USER_NOT_FOUND = 'Usuário não encontrado';
export const EMPTY_PATCH = 'Informe ao menos um campo para alterar';
export const SELF_ROLE_OR_ACTIVE = 'Você não pode alterar o próprio papel nem se desativar';
export const LAST_ACTIVE_ADMIN = 'O sistema precisa de pelo menos um administrador ativo';
