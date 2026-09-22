import type { CookieOptions } from 'express';
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'forge_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type EnvReader = (key: string) => string | undefined;

// Secure por padrão; só SESSION_COOKIE_SECURE=false desliga (desenvolvimento em http).
export function sessionCookieOptions(read: EnvReader): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
    secure: read('SESSION_COOKIE_SECURE') !== 'false',
  };
}

export function clearSessionCookieOptions(read: EnvReader): CookieOptions {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(read);
  return options;
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  for (const part of cookieHeader?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === SESSION_COOKIE) {
      const value = part.slice(separator + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
