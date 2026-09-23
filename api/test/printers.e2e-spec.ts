import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createPrinter } from './printers-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const NOT_FOUND = { error: 'Impressora não encontrada' };

const EMAILS = ['prt-admin@test.local', 'prt-production@test.local', 'prt-sales@test.local'];

const VALID_PRINTER = {
  name: 'X2D',
  acquisitionCostCents: 500000,
  lifespanHours: 10000,
  powerWatts: 250,
  nozzles: [{ diameterMm: 0.4, type: 'Hardened Steel' }],
  hasAms: false,
};

describe('Printers (e2e)', () => {
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
    await dataSource.query('DELETE FROM printers');
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // Cada teste semeia só o que precisa; sem estado entre testes (a rota não tem unicidade
  // sobre name, então a tabela inteira é o escopo de isolamento mais simples).
  beforeEach(async () => {
    await dataSource.query('DELETE FROM printers');
  });

  const server = () => app.getHttpServer();
  const createReq = (body: object, cookie?: string) => {
    const call = request(server()).post('/printers').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const listReq = (query: string, cookie?: string) => {
    const call = request(server()).get(`/printers${query}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/printers/${id}`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const hourmeterReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/printers/${id}/hourmeter`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const countAll = async () => {
    const rows: Array<{ count: string }> = await dataSource.query('SELECT count(*) FROM printers');
    return Number(rows[0]?.count ?? 0);
  };

  // S1 - Cadastrar impressora, só admin

  it('creates a printer without AMS with hourmeterHours 0 and active true', async () => {
    const response = await createReq(VALID_PRINTER, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ...VALID_PRINTER,
      hourmeterHours: 0,
      amsSlots: null,
      active: true,
    });
    expect(typeof response.body.id).toBe('string');
    expect(response.body.id.length).toBeGreaterThan(0);
  });

  it('creates a printer with AMS and persists amsSlots', async () => {
    const response = await createReq({ ...VALID_PRINTER, hasAms: true, amsSlots: 4 }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.hasAms).toBe(true);
    expect(response.body.amsSlots).toBe(4);
  });

  it('persists an explicit hourmeterHours instead of the default', async () => {
    const response = await createReq({ ...VALID_PRINTER, hourmeterHours: 120.5 }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.hourmeterHours).toBe(120.5);
  });

  it('rejects out-of-range cost, lifespan and power fields', async () => {
    const cases = [
      { ...VALID_PRINTER, acquisitionCostCents: 0 },
      { ...VALID_PRINTER, lifespanHours: 0 },
      { ...VALID_PRINTER, lifespanHours: 100001 },
      { ...VALID_PRINTER, powerWatts: 0 },
      { ...VALID_PRINTER, powerWatts: 5001 },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects an empty or blank name', async () => {
    const cases = [{ ...VALID_PRINTER, name: '' }, { ...VALID_PRINTER, name: '   ' }];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects an out-of-bounds nozzles list', async () => {
    const cases = [
      { ...VALID_PRINTER, nozzles: [] },
      { ...VALID_PRINTER, nozzles: Array.from({ length: 11 }, () => ({ diameterMm: 0.4, type: 'Steel' })) },
      { ...VALID_PRINTER, nozzles: [{ diameterMm: 0, type: 'Steel' }] },
      { ...VALID_PRINTER, nozzles: [{ diameterMm: 2.01, type: 'Steel' }] },
      { ...VALID_PRINTER, nozzles: [{ diameterMm: 0.4, type: '' }] },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('requires amsSlots when hasAms is true', async () => {
    const cases = [
      { ...VALID_PRINTER, hasAms: true },
      { ...VALID_PRINTER, hasAms: true, amsSlots: 0 },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('ignores amsSlots when hasAms is false', async () => {
    const response = await createReq({ ...VALID_PRINTER, hasAms: false, amsSlots: 4 }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.amsSlots).toBeNull();
  });

  it('rejects a negative hourmeterHours on create', async () => {
    const response = await createReq({ ...VALID_PRINTER, hourmeterHours: -1 }, adminCookie);
    expect(response.status).toBe(400);
    expect(await countAll()).toBe(0);
  });

  it('non-admin roles get 403 on POST /printers', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await createReq(VALID_PRINTER, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
    expect(await countAll()).toBe(0);
  });

  it('POST /printers without a session is 401', async () => {
    const response = await createReq(VALID_PRINTER);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
    expect(await countAll()).toBe(0);
  });

  // S2 - Listar impressoras com paginação, busca e filtro

  it('GET /printers returns the first page for every role, ordered by name', async () => {
    await createPrinter(dataSource, { name: 'm12-a' });
    await createPrinter(dataSource, { name: 'm12-b' });
    await createPrinter(dataSource, { name: 'm12-c' });

    for (const cookie of [adminCookie, productionCookie, salesCookie]) {
      const response = await listReq('', cookie);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(20);
      expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
        'm12-a',
        'm12-b',
        'm12-c',
      ]);
    }
  });

  it('searches by name ignoring case', async () => {
    await createPrinter(dataSource, { name: 'X2D' });
    await createPrinter(dataSource, { name: 'x2d carbon' });
    await createPrinter(dataSource, { name: 'P1S' });

    const response = await listReq('?search=X2D', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: { name: string }) => item.name).sort()).toEqual([
      'X2D',
      'x2d carbon',
    ]);
  });

  it('filters by hasAms', async () => {
    await createPrinter(dataSource, { name: 'm14-ams', hasAms: true, amsSlots: 4 });
    await createPrinter(dataSource, { name: 'm14-no-ams', hasAms: false });

    const response = await listReq('?hasAms=true', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe('m14-ams');
  });

  it('paginates with page and pageSize', async () => {
    for (let i = 1; i <= 15; i++) {
      const name = `m15-${String(i).padStart(2, '0')}`;
      await createPrinter(dataSource, { name });
    }

    const response = await listReq('?page=2&pageSize=10', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(15);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
      'm15-11',
      'm15-12',
      'm15-13',
      'm15-14',
      'm15-15',
    ]);
  });

  it('rejects invalid page and pageSize', async () => {
    const cases = ['?page=0', '?pageSize=0', '?pageSize=101'];
    for (const query of cases) {
      const response = await listReq(query, adminCookie);
      expect(response.status).toBe(400);
    }
  });

  it('GET /printers without a session is 401', async () => {
    const response = await listReq('');
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S3 - Editar impressora, só admin

  it('PATCH persists only the sent fields', async () => {
    const id = await createPrinter(dataSource, {
      name: 'm18-original',
      acquisitionCostCents: 500000,
      lifespanHours: 10000,
      powerWatts: 250,
    });

    const response = await patchReq(id, { name: 'm18-novo' }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: 'm18-novo',
      acquisitionCostCents: 500000,
      lifespanHours: 10000,
      powerWatts: 250,
    });
  });

  it('PATCH with an unknown id is 404', async () => {
    const response = await patchReq('00000000-0000-0000-0000-000000000000', { name: 'X' }, adminCookie);
    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it('rejects invalid fields on PATCH without changing the record', async () => {
    const id = await createPrinter(dataSource, {
      name: 'm19-original',
      acquisitionCostCents: 500000,
      lifespanHours: 10000,
      powerWatts: 250,
      hasAms: false,
    });

    const cases = [
      { acquisitionCostCents: 0 },
      { lifespanHours: 0 },
      { lifespanHours: 100001 },
      { powerWatts: 0 },
      { powerWatts: 5001 },
      { nozzles: [] },
      { nozzles: Array.from({ length: 11 }, () => ({ diameterMm: 0.4, type: 'Steel' })) },
      { nozzles: [{ diameterMm: 2.01, type: 'Steel' }] },
      { nozzles: [{ diameterMm: 0.4, type: '' }] },
      { hasAms: true },
    ];
    for (const body of cases) {
      const response = await patchReq(id, body, adminCookie);
      expect(response.status).toBe(400);
    }

    const [row]: Array<{
      acquisition_cost_cents: number;
      lifespan_hours: number;
      power_watts: number;
      has_ams: boolean;
    }> = await dataSource.query(
      'SELECT acquisition_cost_cents, lifespan_hours, power_watts, has_ams FROM printers WHERE id = $1',
      [id],
    );
    expect(row).toEqual({
      acquisition_cost_cents: 500000,
      lifespan_hours: 10000,
      power_watts: 250,
      has_ams: false,
    });
  });

  it('rejects hourmeterHours on the general PATCH', async () => {
    const id = await createPrinter(dataSource, { name: 'm20-original' });

    const response = await patchReq(id, { hourmeterHours: 500 }, adminCookie);
    expect(response.status).toBe(400);

    const [row]: Array<{ hourmeter_hours: number }> = await dataSource.query(
      'SELECT hourmeter_hours FROM printers WHERE id = $1',
      [id],
    );
    expect(row.hourmeter_hours).toBe(0);
  });

  it('non-admin roles get 403 on PATCH /printers', async () => {
    const id = await createPrinter(dataSource, { name: 'm21-original' });
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await patchReq(id, { name: 'X' }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
  });

  it('PATCH /printers without a session is 401', async () => {
    const id = await createPrinter(dataSource, { name: 'm22-original' });
    const response = await patchReq(id, { name: 'X' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S4 - Ativar e desativar impressora

  it('deactivates a printer without deleting it', async () => {
    const id = await createPrinter(dataSource, { name: 'm23-active' });

    const response = await patchReq(id, { active: false }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);

    const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM printers WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('reactivates an inactive printer', async () => {
    const id = await createPrinter(dataSource, { name: 'm24-inactive', active: false });

    const response = await patchReq(id, { active: true }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(true);
  });

  it('DELETE /printers/:id does not exist', async () => {
    const id = await createPrinter(dataSource, { name: 'm25-no-delete' });
    const response = await request(server()).delete(`/printers/${id}`).set('Cookie', adminCookie);
    expect(response.status).toBe(404);
  });

  // S5 - Ajustar horímetro manualmente

  it('admin and production set an absolute hourmeterHours', async () => {
    for (const cookie of [adminCookie, productionCookie]) {
      const id = await createPrinter(dataSource, { name: 'm26-hourmeter', hourmeterHours: 0 });
      const response = await hourmeterReq(id, { hourmeterHours: 120.5 }, cookie);
      expect(response.status).toBe(200);
      expect(response.body.hourmeterHours).toBe(120.5);
    }
  });

  it('rejects a negative or missing hourmeterHours on adjustment', async () => {
    const id = await createPrinter(dataSource, { name: 'm27-original', hourmeterHours: 10 });
    const cases = [{ hourmeterHours: -1 }, {}];
    for (const body of cases) {
      const response = await hourmeterReq(id, body, adminCookie);
      expect(response.status).toBe(400);
    }

    const [row]: Array<{ hourmeter_hours: number }> = await dataSource.query(
      'SELECT hourmeter_hours FROM printers WHERE id = $1',
      [id],
    );
    expect(row.hourmeter_hours).toBe(10);
  });

  it('hourmeter adjustment with an unknown id is 404', async () => {
    const response = await hourmeterReq(
      '00000000-0000-0000-0000-000000000000',
      { hourmeterHours: 10 },
      adminCookie,
    );
    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it('sales gets 403 on the hourmeter adjustment', async () => {
    const id = await createPrinter(dataSource, { name: 'm30-original' });
    const response = await hourmeterReq(id, { hourmeterHours: 10 }, salesCookie);
    expect(response.status).toBe(403);
    expect(response.body).toEqual(PERMISSION_DENIED);
  });

  it('hourmeter adjustment without a session is 401', async () => {
    const id = await createPrinter(dataSource, { name: 'm31-original' });
    const response = await hourmeterReq(id, { hourmeterHours: 10 });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });
});
