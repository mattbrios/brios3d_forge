import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createSalesChannel, deleteSalesChannels, resetSettings } from './settings-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const DUPLICATE_NAME = { error: 'Já existe um canal com este nome' };
const NOT_FOUND = { error: 'Canal não encontrado' };

const EMAILS = ['sc-admin@test.local', 'sc-production@test.local', 'sc-sales@test.local'];
const CHANNEL_NAMES = [
  'sc3-inativo',
  'Loja física 2',
  'sc15-exata',
  'sc15-acima',
  'sc19-canal',
  'sc22-canal',
  'sc26-concorrente',
];

describe('Sales channels (e2e)', () => {
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
    await deleteSalesChannels(dataSource, CHANNEL_NAMES);
    await createUser(dataSource, { email: EMAILS[0], role: 'admin' });
    await createUser(dataSource, { email: EMAILS[1], role: 'production' });
    await createUser(dataSource, { email: EMAILS[2], role: 'sales' });
    adminCookie = await loginCookie(app.getHttpServer(), EMAILS[0]);
    productionCookie = await loginCookie(app.getHttpServer(), EMAILS[1]);
    salesCookie = await loginCookie(app.getHttpServer(), EMAILS[2]);
  });

  afterAll(async () => {
    await deleteSalesChannels(dataSource, CHANNEL_NAMES);
    await resetSettings(dataSource);
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  const server = () => app.getHttpServer();
  const listChannels = (cookie?: string) => {
    const call = request(server()).get('/sales-channels');
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const createChannel = (body: object, cookie?: string) => {
    const call = request(server()).post('/sales-channels').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchChannel = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/sales-channels/${id}`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const countChannels = async (name: string) => {
    const rows: Array<{ count: string }> = await dataSource.query(
      'SELECT count(*) FROM sales_channels WHERE name = $1',
      [name],
    );
    return Number(rows[0]?.count ?? 0);
  };
  const idOf = async (name: string) => {
    const rows: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM sales_channels WHERE name = $1',
      [name],
    );
    return rows[0]?.id as string;
  };

  it('GET /sales-channels lists every channel for every role, including inactive', async () => {
    await createSalesChannel(dataSource, { name: 'sc3-inativo', active: false });
    for (const cookie of [adminCookie, productionCookie, salesCookie]) {
      const response = await listChannels(cookie);
      expect(response.status).toBe(200);
      const channels = response.body as Array<{ name: string; active: boolean }>;
      expect(channels.find((c) => c.name === 'sc3-inativo')).toMatchObject({ active: false });
    }
  });

  it('GET /sales-channels without a session is 401', async () => {
    const response = await listChannels();
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  it('the migration seeds exactly the 5 CONTEXT channels', async () => {
    const names = ['Balcão', 'Instagram/WhatsApp', 'Mercado Livre', 'Shopee', 'Loja própria'];
    const rows: Array<{ name: string; tax_rate: number; fee_rate: number; active: boolean }> =
      await dataSource.query(
        'SELECT name, tax_rate, fee_rate, active FROM sales_channels WHERE name = ANY($1) ORDER BY name',
        [names],
      );
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.name)).toEqual([...names].sort());
    for (const row of rows) {
      expect(row).toMatchObject({ tax_rate: 0, fee_rate: 0, active: true });
    }
  });

  it('creates a channel with active true', async () => {
    const response = await createChannel(
      { name: 'Loja física 2', taxRate: 0.06, feeRate: 0.02 },
      adminCookie,
    );
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Loja física 2',
      taxRate: 0.06,
      feeRate: 0.02,
      active: true,
    });
    expect(typeof response.body.id).toBe('string');
  });

  it('rejects a channel whose combined rate reaches 100%', async () => {
    const marginChange = await request(server())
      .patch('/settings')
      .set('Cookie', adminCookie)
      .send({ defaultMarginRate: 0.5 });
    expect(marginChange.status).toBe(200);

    const exact = await createChannel({ name: 'sc15-exata', taxRate: 0.3, feeRate: 0.2 }, adminCookie);
    expect(exact.status).toBe(400);
    const over = await createChannel({ name: 'sc15-acima', taxRate: 0.3, feeRate: 0.21 }, adminCookie);
    expect(over.status).toBe(400);

    expect(await countChannels('sc15-exata')).toBe(0);
    expect(await countChannels('sc15-acima')).toBe(0);

    const reset = await request(server())
      .patch('/settings')
      .set('Cookie', adminCookie)
      .send({ defaultMarginRate: 0 });
    expect(reset.status).toBe(200);
  });

  it('duplicate channel name is 409', async () => {
    const response = await createChannel(
      { name: '  Loja física 2  ', taxRate: 0.01, feeRate: 0.01 },
      adminCookie,
    );
    expect(response.status).toBe(409);
    expect(response.body).toEqual(DUPLICATE_NAME);
  });

  it('non-admin roles get 403 on POST /sales-channels', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await createChannel({ name: 'sc17-negado', taxRate: 0.01, feeRate: 0.01 }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
  });

  it('POST /sales-channels without a session is 401', async () => {
    const response = await createChannel({ name: 'sc18-negado', taxRate: 0.01, feeRate: 0.01 });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  it('PATCH persists only the sent fields, including toggling active', async () => {
    const id = await createSalesChannel(dataSource, { name: 'sc19-canal', taxRate: 0.1, feeRate: 0.05 });

    const first = await patchChannel(id, { taxRate: 0.2 }, adminCookie);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ name: 'sc19-canal', taxRate: 0.2, feeRate: 0.05, active: true });

    const second = await patchChannel(id, { active: false }, adminCookie);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ name: 'sc19-canal', taxRate: 0.2, feeRate: 0.05, active: false });
  });

  it('PATCH /sales-channels/:id without a session is 401', async () => {
    const id = await idOf('sc19-canal');
    const response = await patchChannel(id, { active: true });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  it('renaming to a duplicate name is 409', async () => {
    const shopeeId = await idOf('Shopee');
    const response = await patchChannel(shopeeId, { name: '  Balcão  ' }, adminCookie);
    expect(response.status).toBe(409);
    expect(response.body).toEqual(DUPLICATE_NAME);

    const names: Array<{ name: string }> = await dataSource.query(
      'SELECT name FROM sales_channels WHERE name = ANY($1) ORDER BY name',
      [['Balcão', 'Shopee']],
    );
    expect(names.map((row) => row.name)).toEqual(['Balcão', 'Shopee']);
  });

  it('PATCH validates the combined rate using the final values', async () => {
    const id = await createSalesChannel(dataSource, { name: 'sc22-canal', taxRate: 0.2, feeRate: 0.2 });
    const marginChange = await request(server())
      .patch('/settings')
      .set('Cookie', adminCookie)
      .send({ defaultMarginRate: 0.5 });
    expect(marginChange.status).toBe(200);

    const response = await patchChannel(id, { feeRate: 0.31 }, adminCookie);
    expect(response.status).toBe(400);

    const [row]: Array<{ fee_rate: number }> = await dataSource.query(
      'SELECT fee_rate FROM sales_channels WHERE id = $1',
      [id],
    );
    expect(row.fee_rate).toBe(0.2);

    const reset = await request(server())
      .patch('/settings')
      .set('Cookie', adminCookie)
      .send({ defaultMarginRate: 0 });
    expect(reset.status).toBe(200);
  });

  it('non-admin roles get 403 on PATCH /sales-channels/:id', async () => {
    const id = await idOf('sc19-canal');
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await patchChannel(id, { active: true }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
  });

  it('PATCH with an unknown id is 404', async () => {
    const response = await patchChannel(
      '00000000-0000-0000-0000-000000000000',
      { active: true },
      adminCookie,
    );
    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it('PATCH with a non-uuid id is 400', async () => {
    const response = await patchChannel('nao-e-uuid', { active: true }, adminCookie);
    expect(response.status).toBe(400);
  });

  it('concurrent creation with the same name creates one channel', async () => {
    const body = { name: 'sc26-concorrente', taxRate: 0.01, feeRate: 0.01 };
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => createChannel(body, adminCookie)),
    );
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
    expect(await countChannels('sc26-concorrente')).toBe(1);
  });
});
