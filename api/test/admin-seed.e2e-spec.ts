import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { deleteUsers } from './auth-helper.js';

const EMAILS = [
  'seed30@test.local',
  'seed30-named@test.local',
  'seed32@test.local',
  'seed33@test.local',
  'seed34@test.local',
];

async function boot(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

function adminEnv(env: { email?: string; password?: string; name?: string }) {
  vi.stubEnv('ADMIN_EMAIL', env.email ?? '');
  vi.stubEnv('ADMIN_PASSWORD', env.password ?? '');
  vi.stubEnv('ADMIN_NAME', env.name ?? '');
}

describe('Admin seed (e2e)', () => {
  let base: INestApplication<App>;
  let dataSource: DataSource;
  const extra: INestApplication[] = [];

  const usersWith = async (email: string) =>
    (await dataSource.query(
      'SELECT name, role, active, password_hash FROM users WHERE email = $1',
      [email],
    )) as Array<{ name: string; role: string; active: boolean; password_hash: string }>;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    adminEnv({});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    base = await boot();
    dataSource = base.get(DataSource);
    await deleteUsers(dataSource, EMAILS);
  });

  afterEach(async () => {
    await Promise.all(extra.splice(0).map((app) => app.close()));
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await deleteUsers(dataSource, EMAILS);
    await base.close();
    vi.restoreAllMocks();
  });

  it('creates the first admin', async () => {
    adminEnv({ email: '  Seed30@Test.Local ', password: 'doze-chars12' });
    const app = await boot();
    extra.push(app);
    const rows = await usersWith('seed30@test.local');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'admin', active: true, name: 'Administrador' });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'seed30@test.local', password: 'doze-chars12' });
    expect(login.status).toBe(200);

    adminEnv({ email: 'seed30-named@test.local', password: 'doze-chars12', name: 'Mateus' });
    extra.push(await boot());
    expect((await usersWith('seed30-named@test.local'))[0].name).toBe('Mateus');
  });

  it('keeps an existing user untouched', async () => {
    // Cria o usuário se C30 não rodou antes, para a prova passar sozinha.
    if ((await usersWith('seed30@test.local')).length === 0) {
      adminEnv({ email: 'seed30@test.local', password: 'doze-chars12' });
      extra.push(await boot());
      vi.unstubAllEnvs();
    }
    await dataSource.query(
      `UPDATE users SET role = 'sales', active = false, name = 'Outro' WHERE email = 'seed30@test.local'`,
    );
    const [before] = await usersWith('seed30@test.local');
    adminEnv({ email: 'seed30@test.local', password: 'outra-senha-longa', name: 'Novo Nome' });
    extra.push(await boot());
    const after = await usersWith('seed30@test.local');
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual(before);
    expect(after[0]).toMatchObject({ role: 'sales', active: false, name: 'Outro' });
  });

  it('skips the seed without admin env', async () => {
    for (const env of [{ password: 'doze-chars12' }, { email: 'seed32@test.local' }]) {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      // Os outros arquivos e2e gravam usuários em paralelo; o espião isola o que esta app fez.
      const insert = vi.spyOn(Repository.prototype, 'insert');
      adminEnv(env);
      extra.push(await boot());
      expect(await usersWith('seed32@test.local')).toHaveLength(0);
      expect(insert).not.toHaveBeenCalled();
      insert.mockRestore();
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(
        messages.some((message) => message.includes('ADMIN_EMAIL') && message.includes('ADMIN_PASSWORD')),
      ).toBe(true);
      warn.mockClear();
      vi.unstubAllEnvs();
    }
  });

  it('refuses a short admin password', async () => {
    adminEnv({ email: 'seed33@test.local', password: 'onze-chars1' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await expect(app.init()).rejects.toThrow('ADMIN_PASSWORD precisa ter pelo menos 12 caracteres');
    extra.push(app);
    expect(await usersWith('seed33@test.local')).toHaveLength(0);
  });

  it('concurrent seeds create one admin', async () => {
    adminEnv({ email: 'seed34@test.local', password: 'doze-chars12' });
    const apps = await Promise.all([boot(), boot()]);
    extra.push(...apps);
    expect(await usersWith('seed34@test.local')).toHaveLength(1);
  });
});
