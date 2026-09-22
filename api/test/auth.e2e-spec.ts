import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import {
  PASSWORD,
  createUser,
  deleteUsers,
  loginCookie,
  sessionCookieOf,
  sha256,
  tokenOf,
} from './auth-helper.js';

const EMAILS = [
  'c1@test.local',
  'c2@test.local',
  'c3@test.local',
  'c3-inactive@test.local',
  'c6@test.local',
  'c9@test.local',
  'c9b@test.local',
  'c10@test.local',
  'c13@test.local',
  'c14@test.local',
  'c14-inactive@test.local',
  'c19@test.local',
  'c28@test.local',
  'c28b@test.local',
  'c29@test.local',
  'c12@test.local',
  'c53@test.local',
  'c57@test.local',
  'c57b@test.local',
  'c58@test.local',
];
const INVALID = { error: 'E-mail ou senha inválidos' };
const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await deleteUsers(dataSource, EMAILS);
  });

  afterAll(async () => {
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  const server = () => app.getHttpServer();
  const login = (body: object) => request(server()).post('/auth/login').send(body);
  const me = (cookie?: string) => {
    const call = request(server()).get('/auth/me');
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const sessionsOf = async (userId: string) =>
    (await dataSource.query('SELECT token_hash FROM sessions WHERE user_id = $1', [userId])) as Array<{
      token_hash: string;
    }>;

  it('login returns the user and the session cookie', async () => {
    await createUser(dataSource, { email: 'c1@test.local', name: 'Ana C1' });
    const response = await login({ email: 'c1@test.local', password: PASSWORD });
    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['email', 'id', 'name', 'role']);
    expect(body.id).toMatch(UUID);
    expect(body).toMatchObject({ name: 'Ana C1', email: 'c1@test.local', role: 'admin' });

    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(1);
    const parts = cookies[0].split(';').map((part) => part.trim());
    expect(parts[0]).toMatch(/^forge_session=[A-Za-z0-9_-]{43}$/);
    expect(parts).toContain('HttpOnly');
    expect(parts).toContain('SameSite=Lax');
    expect(parts).toContain('Path=/');
    expect(parts).toContain('Max-Age=604800');
  });

  it('normalizes the login email', async () => {
    await createUser(dataSource, { email: 'c2@test.local' });
    const response = await login({ email: '  C2@Test.Local ', password: PASSWORD });
    expect(response.status).toBe(200);
    expect((response.body as { email: string }).email).toBe('c2@test.local');
  });

  it('invalid credentials are 401', async () => {
    await createUser(dataSource, { email: 'c3@test.local' });
    await createUser(dataSource, { email: 'c3-inactive@test.local', active: false });
    const cases = [
      { email: 'c3@test.local', password: 'senha-errada-12' },
      { email: 'naoexiste-c3@test.local', password: PASSWORD },
      { email: 'c3-inactive@test.local', password: PASSWORD },
    ];
    for (const body of cases) {
      const response = await login(body);
      expect(response.status).toBe(401);
      expect(response.body).toEqual(INVALID);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('login body validation', async () => {
    const bodies = [
      {},
      { email: 'ana', password: PASSWORD },
      { email: 'ana@test.local', password: '' },
      { email: 'ana@test.local', password: 'x'.repeat(257) },
      { email: 'ana@test.local', password: 123 },
      { email: 'ana@test.local', password: PASSWORD, remember: true },
    ];
    for (const body of bodies) {
      const response = await login(body);
      expect(response.status).toBe(400);
      expect(typeof (response.body as { error: unknown }).error).toBe('string');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    const edge = await login({ email: 'borda-c5@test.local', password: 'x'.repeat(256) });
    expect(edge.status).toBe(401);
  });

  it('stores only hashes', async () => {
    const userId = await createUser(dataSource, { email: 'c6@test.local' });
    const cookie = await loginCookie(server(), 'c6@test.local');
    const token = tokenOf(cookie);

    const [userRow] = (await dataSource.query('SELECT * FROM users WHERE id = $1', [userId])) as Array<
      Record<string, unknown>
    >;
    expect(userRow.password_hash).toMatch(
      /^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$/,
    );
    const sessionRows = (await dataSource.query('SELECT * FROM sessions WHERE user_id = $1', [
      userId,
    ])) as Array<Record<string, unknown>>;
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0].token_hash).toBe(sha256(token));
    expect(sessionRows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionRows[0].token_hash).not.toBe(token);

    const everything = JSON.stringify([userRow, sessionRows]);
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(PASSWORD);
  });

  it("login prunes the user's expired sessions", async () => {
    const c9 = await createUser(dataSource, { email: 'c9@test.local' });
    const c9b = await createUser(dataSource, { email: 'c9b@test.local' });
    const insert = (userId: string, hash: string, interval: string) =>
      dataSource.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + $3::interval)`,
        [userId, sha256(hash), interval],
      );
    await insert(c9, 'c9-expired-1', '-1 day');
    await insert(c9, 'c9-expired-2', '-1 second');
    await insert(c9, 'c9-valid', '1 day');
    await insert(c9b, 'c9b-expired', '-1 day');

    const cookie = await loginCookie(server(), 'c9@test.local');

    const c9Hashes = (await sessionsOf(c9)).map((row) => row.token_hash).sort();
    expect(c9Hashes).toEqual([sha256('c9-valid'), sha256(tokenOf(cookie))].sort());
    expect((await sessionsOf(c9b)).map((row) => row.token_hash)).toEqual([sha256('c9b-expired')]);
  });

  describe('logout', () => {
    let c10: string;
    let cookie: string;
    let other: string;

    beforeAll(async () => {
      c10 = await createUser(dataSource, { email: 'c10@test.local' });
      other = await loginCookie(server(), 'c10@test.local');
      cookie = await loginCookie(server(), 'c10@test.local');
    });

    it('logout deletes the session', async () => {
      const response = await request(server()).post('/auth/logout').set('Cookie', cookie);
      expect(response.status).toBe(204);
      const hashes = (await sessionsOf(c10)).map((row) => row.token_hash);
      expect(hashes).toEqual([sha256(tokenOf(other))]);

      const cleared = (response.headers['set-cookie'] as unknown as string[]).find((value) =>
        value.startsWith('forge_session='),
      );
      expect(cleared).toBeDefined();
      expect(cleared!.split(';')[0]).toBe('forge_session=');
      const expires = /Expires=([^;]+)/.exec(cleared!)?.[1];
      const maxAgeZero = /Max-Age=0(;|$)/.test(cleared!);
      expect(maxAgeZero || (expires !== undefined && Date.parse(expires) < Date.now())).toBe(true);
    });

    // Monta a própria sessão e o próprio logout, para passar rodando sozinho.
    it('session is unusable after logout', async () => {
      await createUser(dataSource, { email: 'c12@test.local' });
      const own = await loginCookie(server(), 'c12@test.local');
      expect((await request(server()).post('/auth/logout').set('Cookie', own)).status).toBe(204);
      const response = await me(own);
      expect(response.status).toBe(401);
    });
  });

  it('logout without a session is 204', async () => {
    expect((await request(server()).post('/auth/logout')).status).toBe(204);
    const unknown = await request(server()).post('/auth/logout').set('Cookie', 'forge_session=naoexiste');
    expect(unknown.status).toBe(204);
  });

  it('me returns the session user', async () => {
    await createUser(dataSource, { email: 'c13@test.local', name: 'Ana C13', role: 'sales' });
    const loginResponse = await login({ email: 'c13@test.local', password: PASSWORD });
    const response = await me(sessionCookieOf(loginResponse)!);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(loginResponse.body);
    expect(Object.keys(response.body as object).sort()).toEqual(['email', 'id', 'name', 'role']);
    expect(response.body).toMatchObject({ name: 'Ana C13', email: 'c13@test.local', role: 'sales' });
  });

  it('me rejects invalid sessions', async () => {
    const c14 = await createUser(dataSource, { email: 'c14@test.local' });
    const expired = await loginCookie(server(), 'c14@test.local');
    await dataSource.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [sha256(tokenOf(expired))],
    );
    const inactiveId = await createUser(dataSource, { email: 'c14-inactive@test.local' });
    const inactive = await loginCookie(server(), 'c14-inactive@test.local');
    await dataSource.query('UPDATE users SET active = false WHERE id = $1', [inactiveId]);

    const responses = [
      await me(),
      await me('forge_session=naoexiste'),
      await me(expired),
      await me(inactive),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual(SESSION_REQUIRED);
    }
    expect(c14).toMatch(UUID);
  });

  it('session lasts seven days without renewal', async () => {
    await createUser(dataSource, { email: 'c19@test.local' });
    const cookie = await loginCookie(server(), 'c19@test.local');
    const hash = sha256(tokenOf(cookie));
    const read = async () =>
      ((await dataSource.query(
        `SELECT extract(epoch from expires_at - created_at) AS ttl, expires_at FROM sessions WHERE token_hash = $1`,
        [hash],
      )) as Array<{ ttl: string; expires_at: Date }>)[0];

    const before = await read();
    expect(Math.abs(Number(before.ttl) - 7 * 24 * 3600)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 10; i++) {
      expect((await me(cookie)).status).toBe(200);
    }
    expect((await read()).expires_at).toEqual(before.expires_at);

    await dataSource.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hash],
    );
    expect((await me(cookie)).status).toBe(401);
  });

  it('sixth attempt is 429', async () => {
    await createUser(dataSource, { email: 'c28@test.local' });
    await createUser(dataSource, { email: 'c28b@test.local' });
    for (let i = 0; i < 5; i++) {
      expect((await login({ email: 'c28@test.local', password: 'senha-errada-12' })).status).toBe(401);
    }
    const blocked = await login({ email: 'c28@test.local', password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos',
    });
    expect(blocked.headers['set-cookie']).toBeUndefined();
    expect((await login({ email: 'c28b@test.local', password: PASSWORD })).status).toBe(200);
  });

  it('concurrent attempts cannot bypass the limit', async () => {
    await createUser(dataSource, { email: 'c53@test.local' });
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => login({ email: 'c53@test.local', password: 'senha-errada-12' })),
    );
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429, 429, 429, 429]);
  });

  it('a correct login never counts as a failure', async () => {
    await createUser(dataSource, { email: 'c57@test.local' });
    await createUser(dataSource, { email: 'c57b@test.local' });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await login({ email: 'c57@test.local', password: 'senha-errada-12' })).status);
    }
    for (let i = 0; i < 2; i++) {
      statuses.push((await login({ email: 'c57@test.local', password: PASSWORD })).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 200, 200]);

    const correct: number[] = [];
    for (let i = 0; i < 6; i++) {
      correct.push((await login({ email: 'c57b@test.local', password: PASSWORD })).status);
    }
    expect(correct).toEqual([200, 200, 200, 200, 200, 200]);
  });

  it('a correct login clears earlier failures', async () => {
    await createUser(dataSource, { email: 'c58@test.local' });
    const sequence = ['senha-errada-12', 'senha-errada-12', PASSWORD, 'senha-errada-12', 'senha-errada-12', PASSWORD];
    const statuses: number[] = [];
    for (const password of sequence) {
      statuses.push((await login({ email: 'c58@test.local', password })).status);
    }
    expect(statuses).toEqual([401, 401, 200, 401, 401, 200]);
  });

  it('attempts count by normalized email', async () => {
    await createUser(dataSource, { email: 'c29@test.local' });
    for (let i = 0; i < 5; i++) {
      await login({ email: '  C29@Test.Local ', password: 'senha-errada-12' });
    }
    expect((await login({ email: 'c29@test.local', password: PASSWORD })).status).toBe(429);

    for (let i = 0; i < 5; i++) {
      expect((await login({ email: 'naoexiste-c29@test.local', password: PASSWORD })).status).toBe(401);
    }
    expect((await login({ email: 'naoexiste-c29@test.local', password: PASSWORD })).status).toBe(429);
  });
});
