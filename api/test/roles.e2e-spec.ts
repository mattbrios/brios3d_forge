import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Roles } from '../src/modules/auth/roles.decorator.js';
import { r1 } from '../src/modules/pricing/fixtures/r1.js';
import { design3007827 } from '../src/modules/print-profiles/fixtures/design-3007827.js';
import { MAKERWORLD_CLIENT } from '../src/modules/print-profiles/makerworld.client.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';

const SEA_STAR_URL =
  'https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944';
const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const EMAILS = [
  'roles-admin@test.local',
  'roles-production@test.local',
  'roles-sales@test.local',
  'roles-c4@test.local',
];

// Rotas de sondagem: uma sem decorator (só admin) e uma liberada explicitamente para sales.
@Controller()
class ProbeController {
  @Get('probe-roles')
  probeRoles() {
    return { ok: true };
  }

  @Roles('sales')
  @Get('probe-sales')
  probeSales() {
    return { ok: true };
  }

  @Roles('production')
  @Get('probe-production')
  probeProduction() {
    return { ok: true };
  }
}

const fakeClient = {
  fetchDesign(): Promise<unknown> {
    return Promise.resolve(design3007827());
  },
};

describe('Role-based authorization (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;
  let productionCookie: string;
  let salesCookie: string;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(MAKERWORLD_CLIENT)
      .useValue(fakeClient)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await deleteUsers(dataSource, EMAILS);
    await createUser(dataSource, { email: EMAILS[0], role: 'admin' });
    await createUser(dataSource, { email: EMAILS[1], role: 'production' });
    await createUser(dataSource, { email: EMAILS[2], role: 'sales' });
    adminCookie = await loginCookie(app.getHttpServer(), EMAILS[0]);
    productionCookie = await loginCookie(app.getHttpServer(), EMAILS[1]);
    salesCookie = await loginCookie(app.getHttpServer(), EMAILS[2]);
  });

  afterAll(async () => {
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  const server = () => app.getHttpServer();

  it('route without @Roles is admin only', async () => {
    const production = await request(server()).get('/probe-roles').set('Cookie', productionCookie);
    expect(production.status).toBe(403);
    expect(production.body).toEqual(PERMISSION_DENIED);

    const sales = await request(server()).get('/probe-roles').set('Cookie', salesCookie);
    expect(sales.status).toBe(403);
    expect(sales.body).toEqual(PERMISSION_DENIED);

    const admin = await request(server()).get('/probe-roles').set('Cookie', adminCookie);
    expect(admin.status).toBe(200);
    expect(admin.body).toEqual({ ok: true });
  });

  it('declared roles admit them, admin always passes', async () => {
    const sales = await request(server()).get('/probe-sales').set('Cookie', salesCookie);
    expect(sales.status).toBe(200);

    const production = await request(server()).get('/probe-sales').set('Cookie', productionCookie);
    expect(production.status).toBe(403);
    expect(production.body).toEqual(PERMISSION_DENIED);

    const admin = await request(server()).get('/probe-sales').set('Cookie', adminCookie);
    expect(admin.status).toBe(200);
  });

  it('no session is 401, not 403', async () => {
    const roles = await request(server()).get('/probe-roles');
    expect(roles.status).toBe(401);
    expect(roles.body).toEqual(SESSION_REQUIRED);

    const sales = await request(server()).get('/probe-sales');
    expect(sales.status).toBe(401);
    expect(sales.body).toEqual(SESSION_REQUIRED);
  });

  it('a role change applies on the next request', async () => {
    const targetId = await createUser(dataSource, { email: EMAILS[3], role: 'sales' });
    const cookie = await loginCookie(app.getHttpServer(), EMAILS[3]);
    const before = await request(server()).get('/probe-sales').set('Cookie', cookie);
    expect(before.status).toBe(200);

    const patch = await request(server())
      .patch(`/users/${targetId}`)
      .set('Cookie', adminCookie)
      .send({ role: 'production' });
    expect(patch.status).toBe(200);

    const afterSales = await request(server()).get('/probe-sales').set('Cookie', cookie);
    expect(afterSales.status).toBe(403);
    expect(afterSales.body).toEqual(PERMISSION_DENIED);

    const afterRoles = await request(server()).get('/probe-roles').set('Cookie', cookie);
    expect(afterRoles.status).toBe(403);

    // O lado positivo: o papel novo passa a abrir uma rota @Roles('production') na próxima
    // requisição, sem novo login.
    const afterProduction = await request(server()).get('/probe-production').set('Cookie', cookie);
    expect(afterProduction.status).toBe(200);
    expect(afterProduction.body).toEqual({ ok: true });
  });

  it('pre-existing routes stay open to every role', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const pricing = await request(server()).post('/pricing/calculate').set('Cookie', cookie).send(r1());
      expect(pricing.status).toBe(200);

      const imported = await request(server())
        .post('/print-profiles/import')
        .set('Cookie', cookie)
        .send({ url: SEA_STAR_URL });
      expect(imported.status).toBe(200);

      const me = await request(server()).get('/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);

      const password = await request(server())
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'not-the-real-one-12', newPassword: 'irrelevant-1234' });
      expect(password.status).not.toBe(403);
    }
  });
});
