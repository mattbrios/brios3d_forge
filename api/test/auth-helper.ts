import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DataSource } from 'typeorm';
import { hashPassword } from '../src/modules/auth/password.js';

export const PASSWORD = 'senha-correta-12';

interface NewUser {
  email: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'production' | 'sales';
  active?: boolean;
}

// Grava o usuário direto no banco, como o seed faria, e devolve o id.
export async function createUser(dataSource: DataSource, user: NewUser): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO users (name, email, role, active, password_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      user.name ?? 'Usuário de teste',
      user.email,
      user.role ?? 'admin',
      user.active ?? true,
      await hashPassword(user.password ?? PASSWORD),
    ],
  );
  return rows[0].id;
}

export async function deleteUsers(dataSource: DataSource, emails: string[]): Promise<void> {
  await dataSource.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
}

export function sessionCookieOf(response: { headers: Record<string, unknown> }): string | null {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const session = cookies.find((cookie) => cookie.startsWith('forge_session='));
  return session ? session.split(';')[0] : null;
}

export function tokenOf(cookie: string): string {
  return cookie.slice('forge_session='.length);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Faz o login pela rota e devolve o cookie pronto para `.set('Cookie', …)`.
export async function loginCookie(
  server: App,
  email: string,
  password: string = PASSWORD,
): Promise<string> {
  const response = await request(server).post('/auth/login').send({ email, password });
  const cookie = sessionCookieOf(response);
  if (response.status !== 200 || !cookie) {
    throw new Error(`login de ${email} falhou: ${response.status}`);
  }
  return cookie;
}
