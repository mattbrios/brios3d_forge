import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PASSWORD, createUser, deleteUsers, loginCookie } from './auth-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const DUPLICATE_EMAIL = { error: 'Já existe um usuário com este e-mail' };
const NOT_FOUND = { error: 'Usuário não encontrado' };
const HASH_FORMAT = /^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$/;

const EMAILS = [
  'u-admin@test.local',
  'u7-zeca@test.local',
  'u7-ana@test.local',
  'u7-bia@test.local',
  'bia9@test.local',
  'u10@test.local',
  'u11@test.local',
  'u13-empty@test.local',
  'u13-max@test.local',
  'u13-11@test.local',
  'u13-12@test.local',
  'u14-bia@test.local',
  'u15-bia@test.local',
  'u17-bia@test.local',
  'u18-admin@test.local',
  'u19-bia@test.local',
  'u21-bia@test.local',
  'u22-self@test.local',
  'u23-self@test.local',
  'u24-self@test.local',
  'u25-a1@test.local',
  'u25-b1@test.local',
  'u25-a2@test.local',
  'u25-b2@test.local',
  'u26-a@test.local',
  'u26-b@test.local',
  'u27-target@test.local',
];

describe('Users administration (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await deleteUsers(dataSource, EMAILS);
    await createUser(dataSource, { email: 'u-admin@test.local', role: 'admin' });
    adminCookie = await loginCookie(app.getHttpServer(), 'u-admin@test.local');
  });

  afterAll(async () => {
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  const server = () => app.getHttpServer();
  const listUsers = (cookie?: string) => {
    const call = request(server()).get('/users');
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const createUserRoute = (body: object, cookie?: string) => {
    const call = request(server()).post('/users').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchUser = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/users/${id}`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const me = (cookie: string) => request(server()).get('/auth/me').set('Cookie', cookie);
  const passwordHashOf = async (email: string) => {
    const rows: Array<{ password_hash: string }> = await dataSource.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email],
    );
    return rows[0]?.password_hash;
  };
  const idOf = async (email: string) => {
    const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    return rows[0]?.id as string;
  };
  const countUsers = async (email: string) => {
    const rows: Array<{ count: string }> = await dataSource.query(
      'SELECT count(*) FROM users WHERE email = $1',
      [email],
    );
    return Number(rows[0]?.count ?? 0);
  };

  it('lists every user ordered by name', async () => {
    await createUser(dataSource, { email: 'u7-zeca@test.local', name: 'Zeca', role: 'production' });
    await createUser(dataSource, { email: 'u7-ana@test.local', name: 'Ana', role: 'admin' });
    await createUser(dataSource, { email: 'u7-bia@test.local', name: 'Bia', role: 'sales', active: false });

    const response = await listUsers(adminCookie);
    expect(response.status).toBe(200);
    const relevant = (response.body as Array<{ email: string }>).filter((user) =>
      ['u7-zeca@test.local', 'u7-ana@test.local', 'u7-bia@test.local'].includes(user.email),
    );
    expect(relevant.map((user) => user.email)).toEqual([
      'u7-ana@test.local',
      'u7-bia@test.local',
      'u7-zeca@test.local',
    ]);
    for (const user of response.body as Array<Record<string, unknown>>) {
      expect(Object.keys(user).sort()).toEqual(['active', 'email', 'id', 'name', 'role']);
    }
  });

  it('GET /users without a session is 401', async () => {
    const unauthenticated = await listUsers();
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual(SESSION_REQUIRED);
  });

  it('non-admin roles get 403 on the real /users route', async () => {
    await createUser(dataSource, { email: 'u7b-production@test.local', role: 'production' });
    await createUser(dataSource, { email: 'u7b-sales@test.local', role: 'sales' });
    EMAILS.push('u7b-production@test.local', 'u7b-sales@test.local');
    const productionCookie = await loginCookie(app.getHttpServer(), 'u7b-production@test.local');
    const salesCookie = await loginCookie(app.getHttpServer(), 'u7b-sales@test.local');

    for (const cookie of [productionCookie, salesCookie]) {
      const response = await listUsers(cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Você não tem permissão para esta ação' });
    }
  });

  it('creates a user that can log in with the given role', async () => {
    const response = await createUserRoute(
      { name: 'Bia', email: '  Bia9@Test.Local ', password: 'senha-da-bia-12', role: 'sales' },
      adminCookie,
    );
    expect(response.status).toBe(201);
    // Chaves exatas, não um subconjunto: `toMatchObject` deixaria passar um `password_hash`
    // vazado no corpo (door 2, AD-019).
    expect(Object.keys(response.body as object).sort()).toEqual([
      'active',
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(response.body).toMatchObject({
      email: 'bia9@test.local',
      role: 'sales',
      active: true,
    });

    const login = await request(server())
      .post('/auth/login')
      .send({ email: 'bia9@test.local', password: 'senha-da-bia-12' });
    expect(login.status).toBe(200);
    expect((login.body as { role: string }).role).toBe('sales');
  });

  it('stores the created password only as a scrypt hash', async () => {
    const hash = await passwordHashOf('bia9@test.local');
    expect(hash).toMatch(HASH_FORMAT);
  });

  it('duplicate email is 409', async () => {
    await createUser(dataSource, { email: 'u10@test.local' });
    const before = await countUsers('u10@test.local');
    const response = await createUserRoute(
      { name: 'Outro', email: 'U10@Test.Local', password: 'senha-qualquer-1', role: 'sales' },
      adminCookie,
    );
    expect(response.status).toBe(409);
    expect(response.body).toEqual(DUPLICATE_EMAIL);
    expect(await countUsers('u10@test.local')).toBe(before);
  });

  it('POST /users without a session is 401', async () => {
    const unauthenticated = await createUserRoute({
      name: 'X',
      email: 'irrelevant@test.local',
      password: 'senha-qualquer-1',
      role: 'sales',
    });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual(SESSION_REQUIRED);
  });

  it('concurrent creation with the same email creates one user', async () => {
    const body = { name: 'Onze', email: 'u11@test.local', password: 'senha-concorrente-1', role: 'sales' };
    const responses = await Promise.all(Array.from({ length: 10 }, () => createUserRoute(body, adminCookie)));
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
    expect(await countUsers('u11@test.local')).toBe(1);
  });

  it('create body validation', async () => {
    const valid = { name: 'Nome', email: 'u12@test.local', password: 'senha-valida-1', role: 'sales' };
    const cases = [
      { ...valid, name: '   ' },
      { ...valid, name: 'x'.repeat(101) },
      { ...valid, email: 'nao-e-email' },
      { ...valid, password: 'onze-chars1' },
      { ...valid, password: 'x'.repeat(257) },
      { ...valid, role: 'owner' },
      { name: 'Sem email', password: 'senha-valida-1', role: 'sales' },
      { ...valid, extra: true },
    ];
    for (const body of cases) {
      const response = await createUserRoute(body, adminCookie);
      expect(response.status).toBe(400);
      expect(typeof (response.body as { error: unknown }).error).toBe('string');
    }
    expect(await countUsers('u12@test.local')).toBe(0);
  });

  it('name and password length edges', async () => {
    const emptyName = await createUserRoute(
      { name: '', email: 'u13-empty@test.local', password: 'senha-valida-1', role: 'sales' },
      adminCookie,
    );
    expect(emptyName.status).toBe(400);

    const maxName = await createUserRoute(
      { name: 'x'.repeat(100), email: 'u13-max@test.local', password: 'senha-valida-1', role: 'sales' },
      adminCookie,
    );
    expect(maxName.status).toBe(201);

    const shortPassword = await createUserRoute(
      { name: 'Nome', email: 'u13-11@test.local', password: 'onze-chars1', role: 'sales' },
      adminCookie,
    );
    expect(shortPassword.status).toBe(400);

    const okPassword = await createUserRoute(
      { name: 'Nome', email: 'u13-12@test.local', password: 'doze-caracts', role: 'sales' },
      adminCookie,
    );
    expect(okPassword.status).toBe(201);
  });

  it('patch updates only the given fields', async () => {
    const id = await createUser(dataSource, { email: 'u14-bia@test.local', name: 'Bia', role: 'sales' });
    const nameOnly = await patchUser(id, { name: 'Bia Nova' }, adminCookie);
    expect(nameOnly.status).toBe(200);
    // Chaves exatas: um `password_hash` vazado no corpo do PATCH passaria num `toMatchObject`
    // (door 2, AD-019).
    expect(Object.keys(nameOnly.body as object).sort()).toEqual([
      'active',
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(nameOnly.body).toMatchObject({
      name: 'Bia Nova',
      email: 'u14-bia@test.local',
      role: 'sales',
      active: true,
    });

    const roleOnly = await patchUser(id, { role: 'production' }, adminCookie);
    expect(roleOnly.status).toBe(200);
    expect(roleOnly.body).toMatchObject({
      name: 'Bia Nova',
      email: 'u14-bia@test.local',
      role: 'production',
      active: true,
    });
  });

  it('deactivating a user revokes its session and login', async () => {
    const id = await createUser(dataSource, { email: 'u15-bia@test.local', role: 'sales' });
    const targetCookie = await loginCookie(app.getHttpServer(), 'u15-bia@test.local');

    const response = await patchUser(id, { active: false }, adminCookie);
    expect(response.status).toBe(200);
    expect((response.body as { active: boolean }).active).toBe(false);

    expect((await me(targetCookie)).status).toBe(401);
    const login = await request(server())
      .post('/auth/login')
      .send({ email: 'u15-bia@test.local', password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body).toEqual({ error: 'E-mail ou senha inválidos' });

    // A sessão do alvo é apagada, não só rejeitada pelo `AuthGuard` por `active: false`: sem
    // esta linha, uma reativação (C16) ressuscitaria a sessão antiga sem novo login.
    const remaining: Array<{ count: string }> = await dataSource.query(
      'SELECT count(*) FROM sessions WHERE user_id = $1',
      [id],
    );
    expect(Number(remaining[0]?.count)).toBe(0);
  });

  it('reactivating restores login', async () => {
    const id = await idOf('u15-bia@test.local');
    const response = await patchUser(id, { active: true }, adminCookie);
    expect(response.status).toBe(200);
    expect((response.body as { active: boolean }).active).toBe(true);

    const login = await request(server())
      .post('/auth/login')
      .send({ email: 'u15-bia@test.local', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it("resetting the password revokes the target's other sessions", async () => {
    const id = await createUser(dataSource, { email: 'u17-bia@test.local', role: 'sales' });
    const sessionA = await loginCookie(app.getHttpServer(), 'u17-bia@test.local');
    const sessionB = await loginCookie(app.getHttpServer(), 'u17-bia@test.local');

    const response = await patchUser(id, { password: 'senha-nova-2026' }, adminCookie);
    expect(response.status).toBe(200);

    expect(
      (await request(server()).post('/auth/login').send({ email: 'u17-bia@test.local', password: PASSWORD }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(server())
          .post('/auth/login')
          .send({ email: 'u17-bia@test.local', password: 'senha-nova-2026' })
      ).status,
    ).toBe(200);
    expect((await me(sessionA)).status).toBe(401);
    expect((await me(sessionB)).status).toBe(401);
  });

  it("changing your own password keeps the current session", async () => {
    await createUser(dataSource, { email: 'u18-admin@test.local', role: 'admin' });
    const otherSession = await loginCookie(app.getHttpServer(), 'u18-admin@test.local');
    const callingSession = await loginCookie(app.getHttpServer(), 'u18-admin@test.local');
    const id = await idOf('u18-admin@test.local');

    const response = await patchUser(id, { password: 'nova-senha-admin-1' }, callingSession);
    expect(response.status).toBe(200);

    expect((await me(callingSession)).status).toBe(200);
    expect((await me(otherSession)).status).toBe(401);
  });

  it('invalid id is 400, missing id is 404', async () => {
    const invalid = await patchUser('naoexiste', { name: 'X' }, adminCookie);
    expect(invalid.status).toBe(400);

    const missing = await patchUser('00000000-0000-0000-0000-000000000000', { name: 'X' }, adminCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(NOT_FOUND);
  });

  it('PATCH /users/:id without a session is 401', async () => {
    const id = await createUser(dataSource, { email: 'u19-bia@test.local' });
    const unauthenticated = await patchUser(id, { name: 'X' });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual(SESSION_REQUIRED);
  });

  it('empty patch body is 400', async () => {
    const id = await createUser(dataSource, { email: 'u20@test.local' });
    const response = await patchUser(id, {}, adminCookie);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Informe ao menos um campo para alterar' });
    await deleteUsers(dataSource, ['u20@test.local']);
  });

  it('patch body validation', async () => {
    const id = await createUser(dataSource, { email: 'u21-bia@test.local', name: 'Original' });
    const cases = [
      { name: '   ' },
      { email: 'nao-e-email' },
      { role: 'owner' },
      { password: 'onze-chars1' },
      { active: 'sim' },
      { name: 'ok', extra: 1 },
    ];
    for (const body of cases) {
      const response = await patchUser(id, body, adminCookie);
      expect(response.status).toBe(400);
    }
    const [row]: Array<{ name: string; email: string; role: string; active: boolean }> =
      await dataSource.query('SELECT name, email, role, active FROM users WHERE id = $1', [id]);
    expect(row).toMatchObject({
      name: 'Original',
      email: 'u21-bia@test.local',
      role: 'admin',
      active: true,
    });
  });

  it('patch to a duplicate email is 409', async () => {
    const id = await createUser(dataSource, { email: 'u22-self@test.local' });
    await createUser(dataSource, { email: 'u22-other@test.local' });
    EMAILS.push('u22-self@test.local', 'u22-other@test.local');
    const response = await patchUser(id, { email: 'U22-Other@Test.Local' }, adminCookie);
    expect(response.status).toBe(409);
    expect(response.body).toEqual(DUPLICATE_EMAIL);

    expect(await countUsers('u22-self@test.local')).toBe(1);
    expect(await countUsers('u22-other@test.local')).toBe(1);
  });

  it('admin cannot change own role or deactivate self', async () => {
    await createUser(dataSource, { email: 'u23-self@test.local', role: 'admin' });
    const cookie = await loginCookie(app.getHttpServer(), 'u23-self@test.local');
    const id = await idOf('u23-self@test.local');

    const role = await patchUser(id, { role: 'sales' }, cookie);
    expect(role.status).toBe(409);
    expect(role.body).toEqual({ error: 'Você não pode alterar o próprio papel nem se desativar' });

    const active = await patchUser(id, { active: false }, cookie);
    expect(active.status).toBe(409);
    expect(active.body).toEqual(role.body);

    const check = await me(cookie);
    expect(check.status).toBe(200);
    expect((check.body as { role: string }).role).toBe('admin');
  });

  it('admin can edit own name', async () => {
    await createUser(dataSource, { email: 'u24-self@test.local', role: 'admin' });
    const cookie = await loginCookie(app.getHttpServer(), 'u24-self@test.local');
    const id = await idOf('u24-self@test.local');
    const response = await patchUser(id, { name: 'Outro Nome' }, cookie);
    expect(response.status).toBe(200);
    expect((response.body as { name: string }).name).toBe('Outro Nome');
  });

  it('demoting or deactivating another admin succeeds while one remains', async () => {
    await createUser(dataSource, { email: 'u25-a1@test.local', role: 'admin' });
    const targetId1 = await createUser(dataSource, { email: 'u25-b1@test.local', role: 'admin' });
    const caller1 = await loginCookie(app.getHttpServer(), 'u25-a1@test.local');
    const demote = await patchUser(targetId1, { role: 'production' }, caller1);
    expect(demote.status).toBe(200);
    // Quem chamou continua admin ativo; só o alvo saiu do papel (AC 26, caminho permitido).
    const [target1]: Array<{ role: string }> = await dataSource.query(
      'SELECT role FROM users WHERE id = $1',
      [targetId1],
    );
    expect(target1.role).toBe('production');
    const [caller1Row]: Array<{ role: string; active: boolean }> = await dataSource.query(
      "SELECT role, active FROM users WHERE email = 'u25-a1@test.local'",
    );
    expect(caller1Row).toEqual({ role: 'admin', active: true });

    await createUser(dataSource, { email: 'u25-a2@test.local', role: 'admin' });
    const targetId2 = await createUser(dataSource, { email: 'u25-b2@test.local', role: 'admin' });
    const caller2 = await loginCookie(app.getHttpServer(), 'u25-a2@test.local');
    const deactivate = await patchUser(targetId2, { active: false }, caller2);
    expect(deactivate.status).toBe(200);
    const [target2]: Array<{ active: boolean }> = await dataSource.query(
      'SELECT active FROM users WHERE id = $1',
      [targetId2],
    );
    expect(target2.active).toBe(false);
    const [caller2Row]: Array<{ role: string; active: boolean }> = await dataSource.query(
      "SELECT role, active FROM users WHERE email = 'u25-a2@test.local'",
    );
    expect(caller2Row).toEqual({ role: 'admin', active: true });
  });

  it('concurrent deactivation of the last two admins keeps one', async () => {
    const idA = await createUser(dataSource, { email: 'u26-a@test.local', role: 'admin' });
    const idB = await createUser(dataSource, { email: 'u26-b@test.local', role: 'admin' });
    const cookieA = await loginCookie(app.getHttpServer(), 'u26-a@test.local');
    const cookieB = await loginCookie(app.getHttpServer(), 'u26-b@test.local');

    // Isola a corrida: sem tirar o admin do arquivo (u-admin) da contagem, ele sempre
    // sobraria como o terceiro admin ativo e o teste nunca chegaria ao caso do último.
    await dataSource.query("UPDATE users SET active = false WHERE email = 'u-admin@test.local'");
    try {
      const [responseA, responseB] = await Promise.all([
        patchUser(idB, { active: false }, cookieA),
        patchUser(idA, { active: false }, cookieB),
      ]);
      // O perdedor da corrida nunca chega a 200. Ele responde 409 (a regra do último admin
      // barrou a chamada) quando a própria sessão ainda era válida quando a checou, ou 401
      // quando a sessão dele já tinha sido revogada pelo PATCH do vencedor antes disso - as
      // duas são consequências corretas, nunca as duas 200 nem as duas bloqueadas.
      const winner = responseA.status === 200 ? responseA : responseB;
      const loser = responseA.status === 200 ? responseB : responseA;
      expect(winner.status).toBe(200);
      expect([401, 409]).toContain(loser.status);
      if (loser.status === 409) {
        expect(loser.body).toEqual({ error: 'O sistema precisa de pelo menos um administrador ativo' });
      } else {
        expect(loser.body).toEqual({ error: 'Sessão expirada ou inexistente. Entre novamente' });
      }
      const rows: Array<{ active: boolean }> = await dataSource.query(
        'SELECT active FROM users WHERE id = ANY($1)',
        [[idA, idB]],
      );
      expect(rows.filter((row) => row.active)).toHaveLength(1);
    } finally {
      await dataSource.query("UPDATE users SET active = true WHERE email = 'u-admin@test.local'");
    }
  });

  it('there is no delete route', async () => {
    const id = await createUser(dataSource, { email: 'u27-target@test.local' });
    const response = await request(server()).delete(`/users/${id}`).set('Cookie', adminCookie);
    expect(response.status).toBe(404);
  });
});
