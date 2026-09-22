export type UserRole = "admin" | "production" | "sales";

// Contrato do usuário autenticado (GET /auth/me e POST /auth/login).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
