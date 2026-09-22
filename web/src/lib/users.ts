import type { UserRole } from "./auth";

// Contrato de GET/POST/PATCH /users (door 2 da Fase 4).
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  production: "Produção",
  sales: "Vendas",
};
