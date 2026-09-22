import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { resetSettings } from './settings-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const EMPTY_PATCH = { error: 'Informe ao menos um campo para alterar' };
const SETTINGS_KEYS = [
  'energyTariffCentsPerKwh',
  'laborCentsPerHour',
  'defaultMarginRate',
  'failureRate',
  'purgeRate',
  'maintenanceCentsPerHour',
  'productiveHoursPerMonth',
  'fixedCostItems',
].sort();

const EMAILS = [
  's-admin@test.local',
  's-production@test.local',
  's-sales@test.local',
];

describe('Settings (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;
  let productionCookie: string;
  let salesCookie: string;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    await resetSettings(dataSource);
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  const server = () => app.getHttpServer();
  const getSettings = (cookie?: string) => {
    const call = request(server()).get('/settings');
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchSettings = (body: object, cookie?: string) => {
    const call = request(server()).patch('/settings').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };

  it('GET /settings returns the configured fields for every role', async () => {
    for (const cookie of [adminCookie, productionCookie, salesCookie]) {
      const response = await getSettings(cookie);
      expect(response.status).toBe(200);
      expect(Object.keys(response.body as object).sort()).toEqual(SETTINGS_KEYS);
    }
  });

  it('GET /settings without a session is 401', async () => {
    const response = await getSettings();
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // Precisa rodar antes de qualquer PATCH deste arquivo (a linha ainda está como a migration
  // semeou). Arquivos que mexem em `settings` restauram os defaults no próprio afterAll.
  it('the migration seeds the singleton settings row with defaults', async () => {
    const response = await getSettings(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      energyTariffCentsPerKwh: 0,
      laborCentsPerHour: 0,
      defaultMarginRate: 0,
      failureRate: 0,
      purgeRate: 0,
      maintenanceCentsPerHour: 0,
      productiveHoursPerMonth: 1,
      fixedCostItems: [],
    });
  });

  it('PATCH persists only the sent fields', async () => {
    const first = await patchSettings({ energyTariffCentsPerKwh: 120 }, adminCookie);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ energyTariffCentsPerKwh: 120, laborCentsPerHour: 0, defaultMarginRate: 0 });

    const second = await patchSettings({ laborCentsPerHour: 300 }, adminCookie);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ energyTariffCentsPerKwh: 120, laborCentsPerHour: 300 });
  });

  it('non-admin roles get 403 on PATCH /settings', async () => {
    const before = (await getSettings(adminCookie)).body;
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await patchSettings({ energyTariffCentsPerKwh: 999 }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
    expect((await getSettings(adminCookie)).body).toEqual(before);
  });

  it('PATCH /settings without a session is 401', async () => {
    const response = await patchSettings({ energyTariffCentsPerKwh: 999 });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  it('rejects out-of-range percentage fields', async () => {
    const before = (await getSettings(adminCookie)).body;
    const fields = ['defaultMarginRate', 'failureRate', 'purgeRate'];
    const values = [-0.1, 1, 1.1];
    for (const field of fields) {
      for (const value of values) {
        const response = await patchSettings({ [field]: value }, adminCookie);
        expect(response.status).toBe(400);
      }
    }
    expect((await getSettings(adminCookie)).body).toEqual(before);
  });

  it('rejects invalid money and hour fields', async () => {
    const before = (await getSettings(adminCookie)).body;
    const cases = [
      { energyTariffCentsPerKwh: -1 },
      { laborCentsPerHour: -1 },
      { maintenanceCentsPerHour: -1 },
      { productiveHoursPerMonth: 0 },
    ];
    for (const body of cases) {
      const response = await patchSettings(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect((await getSettings(adminCookie)).body).toEqual(before);
  });

  it('empty patch body is 400', async () => {
    const response = await patchSettings({}, adminCookie);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(EMPTY_PATCH);
  });

  it('PATCH replaces fixedCostItems wholesale', async () => {
    const seeded = await patchSettings(
      {
        fixedCostItems: [
          { name: 'Aluguel', monthlyCents: 50000 },
          { name: 'Internet', monthlyCents: 10000 },
        ],
      },
      adminCookie,
    );
    expect(seeded.status).toBe(200);
    const oldIds = (seeded.body.fixedCostItems as Array<{ id: string }>).map((item) => item.id);
    expect(oldIds).toHaveLength(2);

    const response = await patchSettings(
      { fixedCostItems: [{ name: 'Software', monthlyCents: 8000 }] },
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect(response.body.fixedCostItems).toEqual([
      { id: expect.any(String), name: 'Software', monthlyCents: 8000 },
    ]);
    const newId = (response.body.fixedCostItems as Array<{ id: string }>)[0].id;
    expect(oldIds).not.toContain(newId);

    const rows: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM fixed_cost_items WHERE settings_id = $1',
      ['00000000-0000-0000-0000-000000000101'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(newId);
  });

  it('an invalid fixedCostItems entry rejects the whole PATCH', async () => {
    const before = (await getSettings(adminCookie)).body;
    const cases = [
      { energyTariffCentsPerKwh: 500, fixedCostItems: [{ name: '', monthlyCents: 1000 }] },
      { energyTariffCentsPerKwh: 500, fixedCostItems: [{ name: 'x'.repeat(61), monthlyCents: 1000 }] },
      { energyTariffCentsPerKwh: 500, fixedCostItems: [{ name: 'Válido', monthlyCents: -1 }] },
    ];
    for (const body of cases) {
      const response = await patchSettings(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect((await getSettings(adminCookie)).body).toEqual(before);
  });
});
