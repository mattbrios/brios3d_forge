import { HttpException, Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import type { Session } from './entities/session.entity.js';
import { LoginAttempts } from './login-attempts.js';
import type { PasswordHasher } from './password.js';

const STORED = 'scrypt$N=131072,r=8,p=1$c2FsdHNhbHRzYWx0c2FsdA==$aGFzaA==';

function user(overrides: Partial<User> = {}): User {
  return {
    id: '5f0c6f1e-0000-4000-8000-000000000001',
    name: 'Ana',
    email: 'ana@test.local',
    role: 'admin',
    active: true,
    passwordHash: STORED,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(found: User | null, passwordOk: boolean) {
  const users = { findOne: vi.fn().mockResolvedValue(found) };
  const sessions = { delete: vi.fn().mockResolvedValue({}), insert: vi.fn().mockResolvedValue({}) };
  const hasher = {
    hash: vi.fn().mockResolvedValue('scrypt$N=131072,r=8,p=1$ZHVtbXlkdW1teWR1bW15ZA==$ZHVtbXk='),
    verify: vi.fn().mockResolvedValue(passwordOk),
  };
  const service = new AuthService(
    users as unknown as Repository<User>,
    sessions as unknown as Repository<Session>,
    hasher as unknown as PasswordHasher,
    new LoginAttempts(),
  );
  return { service, hasher, sessions };
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error.getStatus();
    }
    throw error;
  }
  return 200;
}

describe('AuthService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compares against a dummy hash for unknown emails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const unknown = setup(null, false);
    expect(await statusOf(unknown.service.login('ninguem@test.local', 'qualquer-senha'))).toBe(401);
    expect(unknown.hasher.verify).toHaveBeenCalledTimes(1);
    const [password, hash] = unknown.hasher.verify.mock.calls[0] as [string, string];
    expect(password).toBe('qualquer-senha');
    expect(hash).toMatch(/^scrypt\$N=131072,r=8,p=1\$/);

    const inactive = setup(user({ active: false }), true);
    expect(await statusOf(inactive.service.login('ana@test.local', 'senha-correta-12'))).toBe(401);
    expect(inactive.hasher.verify).toHaveBeenCalledTimes(1);
    expect(inactive.hasher.verify).toHaveBeenCalledWith('senha-correta-12', STORED);
    expect(inactive.sessions.insert).not.toHaveBeenCalled();
  });

  it('logs login outcomes without secrets', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const secrets: string[] = [];

    const ok = setup(user(), true);
    const { token } = await ok.service.login('  Ana@Test.Local ', 'senha-correta-12');
    secrets.push('senha-correta-12', token);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('ana@test.local');

    await statusOf(setup(user(), false).service.login('ana@test.local', 'senha-errada-12'));
    await statusOf(setup(null, false).service.login('ninguem@test.local', 'senha-errada-13'));
    await statusOf(setup(user({ active: false }), true).service.login('ana@test.local', 'senha-inativa-14'));
    secrets.push('senha-errada-12', 'senha-errada-13', 'senha-inativa-14');

    const blocked = setup(user(), false);
    for (let i = 0; i < 5; i++) {
      await statusOf(blocked.service.login('ana@test.local', 'senha-bloqueada-15'));
    }
    expect(await statusOf(blocked.service.login('ana@test.local', 'senha-bloqueada-15'))).toBe(429);
    secrets.push('senha-bloqueada-15');

    const warnings = warn.mock.calls.map((call) => String(call[0]));
    expect(warnings[0]).toContain('ana@test.local');
    expect(warnings[0]).toContain('wrong password');
    expect(warnings[1]).toContain('ninguem@test.local');
    expect(warnings[1]).toContain('unknown email');
    expect(warnings[2]).toContain('ana@test.local');
    expect(warnings[2]).toContain('inactive');
    expect(warnings.at(-1)).toContain('ana@test.local');
    expect(warnings.at(-1)).toContain('blocked');

    const everything = [...log.mock.calls, ...warn.mock.calls].flat().map(String).join('\n');
    for (const secret of secrets) {
      expect(everything).not.toContain(secret);
    }
  });
});
