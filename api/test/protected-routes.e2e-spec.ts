import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { r1 } from '../src/modules/pricing/fixtures/r1.js';
import { design3007827 } from '../src/modules/print-profiles/fixtures/design-3007827.js';
import { MAKERWORLD_CLIENT } from '../src/modules/print-profiles/makerworld.client.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';

const EMAIL = 'routes-user@test.local';
const SEA_STAR_URL =
  'https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944';
const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };

// Rota nova sem nenhum decorator de autenticação: precisa nascer protegida.
@Controller('probe')
class ProbeController {
  @Get()
  probe() {
    return { ok: true };
  }
}

const fakeClient = {
  calls: 0,
  fetchDesign(): Promise<unknown> {
    this.calls++;
    return Promise.resolve(design3007827());
  },
};

describe('Protected routes (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let cookie: string;

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
    await deleteUsers(dataSource, [EMAIL]);
    await createUser(dataSource, { email: EMAIL });
    cookie = await loginCookie(app.getHttpServer(), EMAIL);
  });

  afterAll(async () => {
    await deleteUsers(dataSource, [EMAIL]);
    await app.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fakeClient.calls = 0;
  });

  const server = () => app.getHttpServer();

  it('protected routes require a session', async () => {
    const responses = [
      await request(server()).post('/pricing/calculate').send(r1()),
      await request(server()).post('/print-profiles/import').send({ url: SEA_STAR_URL }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual(SESSION_REQUIRED);
    }
    expect(fakeClient.calls).toBe(0);
  });

  it('protected routes answer with a session', async () => {
    const pricing = await request(server()).post('/pricing/calculate').set('Cookie', cookie).send(r1());
    expect(pricing.status).toBe(200);
    const imported = await request(server())
      .post('/print-profiles/import')
      .set('Cookie', cookie)
      .send({ url: SEA_STAR_URL });
    expect(imported.status).toBe(200);
    expect(fakeClient.calls).toBe(1);
  });

  it('health stays public', async () => {
    expect((await request(server()).get('/health')).status).toBe(200);
  });

  it('undecorated route requires a session', async () => {
    const anonymous = await request(server()).get('/probe');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual(SESSION_REQUIRED);
    const signedIn = await request(server()).get('/probe').set('Cookie', cookie);
    expect(signedIn.status).toBe(200);
    expect(signedIn.body).toEqual({ ok: true });
  });
});
