import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createMaterial } from './materials-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const NOT_FOUND = { error: 'Material não encontrado' };

const EMAILS = ['mat-admin@test.local', 'mat-production@test.local', 'mat-sales@test.local'];

const VALID_PLA = {
  type: 'PLA',
  brand: 'Marca Teste',
  color: 'Natural',
  densityGCm3: 1.24,
  nozzleTempC: 210,
  bedTempC: 60,
  needsDrying: false,
};

describe('Materials (e2e)', () => {
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
    await dataSource.query('DELETE FROM materials');
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // Cada teste semeia só o que precisa; sem estado entre testes (a rota não tem unicidade
  // sobre type+brand+color, então a tabela inteira é o escopo de isolamento mais simples).
  beforeEach(async () => {
    await dataSource.query('DELETE FROM materials');
  });

  const server = () => app.getHttpServer();
  const createReq = (body: object, cookie?: string) => {
    const call = request(server()).post('/materials').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const listReq = (query: string, cookie?: string) => {
    const call = request(server()).get(`/materials${query}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/materials/${id}`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const countAll = async () => {
    const rows: Array<{ count: string }> = await dataSource.query('SELECT count(*) FROM materials');
    return Number(rows[0]?.count ?? 0);
  };

  // S1 - Cadastrar material, só admin

  it('creates a material with active true', async () => {
    const response = await createReq(VALID_PLA, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ...VALID_PLA, active: true });
    expect(typeof response.body.id).toBe('string');
    expect(response.body.id.length).toBeGreaterThan(0);
  });

  it('rejects out-of-range density and temperature fields', async () => {
    const cases = [
      { ...VALID_PLA, densityGCm3: 0 },
      { ...VALID_PLA, densityGCm3: 10.01 },
      { ...VALID_PLA, nozzleTempC: -1 },
      { ...VALID_PLA, nozzleTempC: 501 },
      { ...VALID_PLA, bedTempC: -1 },
      { ...VALID_PLA, bedTempC: 151 },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects empty type, brand or color', async () => {
    const cases = [
      { ...VALID_PLA, type: '' },
      { ...VALID_PLA, brand: '   ' },
      { ...VALID_PLA, color: '' },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects invalid drying parameters when needsDrying is true', async () => {
    const base = { ...VALID_PLA, needsDrying: true };
    const cases = [
      { ...base, dryingHours: 4 },
      { ...base, dryingTemperatureC: -1, dryingHours: 4 },
      { ...base, dryingTemperatureC: 121, dryingHours: 4 },
      { ...base, dryingTemperatureC: 60 },
      { ...base, dryingTemperatureC: 60, dryingHours: 0 },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('ignores drying fields when needsDrying is false', async () => {
    const response = await createReq(
      { ...VALID_PLA, needsDrying: false, dryingTemperatureC: 60, dryingHours: 4 },
      adminCookie,
    );
    expect(response.status).toBe(201);
    expect(response.body.dryingTemperatureC).toBeNull();
    expect(response.body.dryingHours).toBeNull();
  });

  it('non-admin roles get 403 on POST /materials', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await createReq(VALID_PLA, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
    expect(await countAll()).toBe(0);
  });

  it('POST /materials without a session is 401', async () => {
    const response = await createReq(VALID_PLA);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
    expect(await countAll()).toBe(0);
  });

  // S2 - Listar materiais com paginação, busca e filtro

  it('GET /materials returns the first page for every role, ordered by type, brand and color', async () => {
    await createMaterial(dataSource, { type: 'm8-a', brand: 'X', color: 'X' });
    await createMaterial(dataSource, { type: 'm8-b', brand: 'X', color: 'X' });
    await createMaterial(dataSource, { type: 'm8-c', brand: 'X', color: 'X' });

    for (const cookie of [adminCookie, productionCookie, salesCookie]) {
      const response = await listReq('', cookie);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(20);
      expect(response.body.items.map((item: { type: string }) => item.type)).toEqual([
        'm8-a',
        'm8-b',
        'm8-c',
      ]);
    }
  });

  it('filters by type ignoring case', async () => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'A' });
    await createMaterial(dataSource, { type: 'pla', brand: 'B' });
    await createMaterial(dataSource, { type: 'PETG', brand: 'C' });

    const response = await listReq('?type=pla', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: { type: string }) => item.type).sort()).toEqual(['PLA', 'pla']);
  });

  it('searches across type, brand and color ignoring case', async () => {
    await createMaterial(dataSource, { type: 'Vermelho Especial', brand: 'X', color: 'X' });
    await createMaterial(dataSource, { type: 'PLA', brand: 'PLA Vermelho', color: 'X' });
    await createMaterial(dataSource, { type: 'PLA2', brand: 'X', color: 'vermelho fosco' });
    await createMaterial(dataSource, { type: 'Azul', brand: 'Y', color: 'Y' });

    const response = await listReq('?search=vermelho', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.items.map((item: { type: string }) => item.type).sort()).toEqual([
      'PLA',
      'PLA2',
      'Vermelho Especial',
    ]);
  });

  it('paginates with page and pageSize', async () => {
    for (let i = 1; i <= 15; i++) {
      const brand = `b${String(i).padStart(2, '0')}`;
      await createMaterial(dataSource, { type: 'm11-page', brand, color: 'X' });
    }

    const response = await listReq('?page=2&pageSize=10', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(15);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items.map((item: { brand: string }) => item.brand)).toEqual([
      'b11',
      'b12',
      'b13',
      'b14',
      'b15',
    ]);
  });

  it('rejects invalid page and pageSize', async () => {
    const cases = ['?page=0', '?pageSize=0', '?pageSize=101'];
    for (const query of cases) {
      const response = await listReq(query, adminCookie);
      expect(response.status).toBe(400);
    }
  });

  it('GET /materials without a session is 401', async () => {
    const response = await listReq('');
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S3 - Editar material, só admin

  it('PATCH persists only the sent fields', async () => {
    const id = await createMaterial(dataSource, {
      type: 'm14-original',
      brand: 'Marca Original',
      color: 'Cor Original',
      densityGCm3: 1.24,
      nozzleTempC: 200,
      bedTempC: 60,
    });

    const response = await patchReq(id, { color: 'Cor Nova' }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      type: 'm14-original',
      brand: 'Marca Original',
      color: 'Cor Nova',
      densityGCm3: 1.24,
      nozzleTempC: 200,
      bedTempC: 60,
    });
  });

  it('PATCH with an unknown id is 404', async () => {
    const response = await patchReq('00000000-0000-0000-0000-000000000000', { color: 'X' }, adminCookie);
    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it('rejects invalid fields on PATCH without changing the record', async () => {
    const id = await createMaterial(dataSource, { type: 'm16-original', densityGCm3: 1.24 });

    const response = await patchReq(id, { densityGCm3: 15 }, adminCookie);
    expect(response.status).toBe(400);

    const [row]: Array<{ density_g_cm3: number }> = await dataSource.query(
      'SELECT density_g_cm3 FROM materials WHERE id = $1',
      [id],
    );
    expect(row.density_g_cm3).toBe(1.24);
  });

  it('non-admin roles get 403 on PATCH /materials', async () => {
    const id = await createMaterial(dataSource, { type: 'm17-original' });
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await patchReq(id, { color: 'X' }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
  });

  it('PATCH /materials without a session is 401', async () => {
    const id = await createMaterial(dataSource, { type: 'm18-original' });
    const response = await patchReq(id, { color: 'X' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S4 - Ativar e desativar material

  it('deactivates a material without deleting it', async () => {
    const id = await createMaterial(dataSource, { type: 'm19-active' });

    const response = await patchReq(id, { active: false }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);

    const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM materials WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('reactivates an inactive material', async () => {
    const id = await createMaterial(dataSource, { type: 'm20-inactive', active: false });

    const response = await patchReq(id, { active: true }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(true);
  });

  it('DELETE /materials/:id does not exist', async () => {
    const id = await createMaterial(dataSource, { type: 'm21-no-delete' });
    const response = await request(server()).delete(`/materials/${id}`).set('Cookie', adminCookie);
    expect(response.status).toBe(404);
  });
});
