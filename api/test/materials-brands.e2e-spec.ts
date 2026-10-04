import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MaterialsService } from '../src/modules/materials/materials.service.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createMaterial } from './materials-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };

const EMAILS = ['brands-admin@test.local', 'brands-production@test.local', 'brands-sales@test.local'];
const ROLES = ['admin', 'production', 'sales'] as const;

describe('Material brands (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let service: MaterialsService;
  const cookies: Record<(typeof ROLES)[number], string> = { admin: '', production: '', sales: '' };

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    service = app.get(MaterialsService);
    await deleteUsers(dataSource, EMAILS);
    for (const [index, role] of ROLES.entries()) {
      await createUser(dataSource, { email: EMAILS[index], role });
      cookies[role] = await loginCookie(app.getHttpServer(), EMAILS[index]);
    }
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM materials');
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM materials');
  });

  const brandsReq = (cookie?: string) => {
    const call = request(app.getHttpServer()).get('/materials/brands');
    return cookie ? call.set('Cookie', cookie) : call;
  };

  // Rota: papéis e contrato (AC 7, AC 8, AC 12).

  it.each(ROLES)('GET /materials/brands answers 200 for role %s', async (role) => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'Voolt' });

    const res = await brandsReq(cookies[role]).expect(200);

    expect(res.body).toEqual(['Voolt']);
  });

  it('GET /materials/brands without a session is 401', async () => {
    const res = await brandsReq().expect(401);

    expect(res.body).toEqual(SESSION_REQUIRED);
  });

  it('GET /materials/brands answers an empty array without materials', async () => {
    const res = await brandsReq(cookies.sales).expect(200);

    expect(res.body).toEqual([]);
  });

  it('route groups, keeps the newest spelling and orders brands', async () => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'voolt', createdAt: '2026-01-01T00:00:00Z' });
    await createMaterial(dataSource, { type: 'PETG', brand: 'VOOLT', createdAt: '2026-02-01T00:00:00Z' });
    await createMaterial(dataSource, { type: 'ABS', brand: 'Anycubic', active: false });
    await createMaterial(dataSource, { type: 'TPU', brand: 'bambu' });

    const res = await brandsReq(cookies.production).expect(200);

    expect(res.body).toEqual(['Anycubic', 'bambu', 'VOOLT']);
  });

  // Serviço direto contra o banco: uma linha por decisão do `listBrands` (door 3).

  it('listBrands groups brands ignoring case', async () => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'voolt', createdAt: '2026-01-01T00:00:00Z' });
    await createMaterial(dataSource, { type: 'PETG', brand: 'Voolt', createdAt: '2026-02-01T00:00:00Z' });

    expect(await service.listBrands()).toEqual(['Voolt']);
  });

  it('listBrands keeps the spelling of the newest material', async () => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'voolt', createdAt: '2026-01-01T00:00:00Z' });
    await createMaterial(dataSource, { type: 'PETG', brand: 'VOOLT', createdAt: '2026-02-01T00:00:00Z' });
    expect(await service.listBrands()).toEqual(['VOOLT']);

    await dataSource.query('DELETE FROM materials');
    await createMaterial(dataSource, { type: 'PLA', brand: 'voolt', createdAt: '2026-02-01T00:00:00Z' });
    await createMaterial(dataSource, { type: 'PETG', brand: 'VOOLT', createdAt: '2026-01-01T00:00:00Z' });
    expect(await service.listBrands()).toEqual(['voolt']);
  });

  it('listBrands breaks a created_at tie by the greater id', async () => {
    const createdAt = '2026-01-01T00:00:00Z';
    await createMaterial(dataSource, {
      type: 'PLA',
      brand: 'voolt',
      id: '00000000-0000-4000-8000-000000000001',
      createdAt,
    });
    await createMaterial(dataSource, {
      type: 'PETG',
      brand: 'VOOLT',
      id: '00000000-0000-4000-8000-000000000002',
      createdAt,
    });

    expect(await service.listBrands()).toEqual(['VOOLT']);
  });

  it('listBrands includes brands of inactive materials', async () => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'Voolt' });
    await createMaterial(dataSource, { type: 'ABS', brand: 'Anycubic', active: false });

    expect(await service.listBrands()).toEqual(['Anycubic', 'Voolt']);
  });

  it('listBrands orders brands ignoring case', async () => {
    await createMaterial(dataSource, { type: 'PLA', brand: 'Creality' });
    await createMaterial(dataSource, { type: 'PETG', brand: 'bambu' });
    await createMaterial(dataSource, { type: 'ABS', brand: 'Anycubic' });

    expect(await service.listBrands()).toEqual(['Anycubic', 'bambu', 'Creality']);
  });
});
