import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createSupplier } from './suppliers-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const NOT_FOUND = { error: 'Fornecedor não encontrado' };

const EMAILS = ['supl-admin@test.local', 'supl-production@test.local', 'supl-sales@test.local'];

describe('Suppliers (e2e)', () => {
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
    await dataSource.query('DELETE FROM suppliers');
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // Sem unicidade de name, a tabela inteira é o escopo de isolamento mais simples entre testes.
  beforeEach(async () => {
    await dataSource.query('DELETE FROM suppliers');
  });

  const server = () => app.getHttpServer();
  const createReq = (body: object, cookie?: string) => {
    const call = request(server()).post('/suppliers').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const listReq = (query: string, cookie?: string) => {
    const call = request(server()).get(`/suppliers${query}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/suppliers/${id}`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const countAll = async () => {
    const rows: Array<{ count: string }> = await dataSource.query('SELECT count(*) FROM suppliers');
    return Number(rows[0]?.count ?? 0);
  };

  // S5 - Cadastrar fornecedor, só admin

  it('creates a supplier with only name filled', async () => {
    const response = await createReq({ name: '  Filamentos ABC  ' }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Filamentos ABC',
      document: null,
      phone: null,
      email: null,
      address: null,
      active: true,
    });
    expect(typeof response.body.id).toBe('string');
    expect(response.body.id.length).toBeGreaterThan(0);
  });

  it('stores supplier document as digits only for a valid CPF and CNPJ', async () => {
    const cases = [
      { document: '123.456.789-09', digits: '12345678909' },
      { document: '11.222.333/0001-81', digits: '11222333000181' },
    ];
    for (const { document, digits } of cases) {
      const response = await createReq({ name: 'Fornecedor doc', document }, adminCookie);
      expect(response.status).toBe(201);
      expect(response.body.document).toBe(digits);
      await dataSource.query('DELETE FROM suppliers');
    }
  });

  it('rejects a supplier document with the wrong length, an invalid check digit or a repeated-digit sequence', async () => {
    const cases = [
      '1234567890',
      '123456789012345',
      '123.456.789-00',
      '11.222.333/0001-00',
      '111.111.111-11',
      '11.111.111/1111-11',
    ];
    for (const document of cases) {
      const response = await createReq({ name: 'Fornecedor inválido', document }, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects a duplicate supplier document even with different formatting', async () => {
    const first = await createReq({ name: 'Primeiro', document: '123.456.789-09' }, adminCookie);
    expect(first.status).toBe(201);

    const cases = ['123.456.789-09', '12345678909'];
    for (const document of cases) {
      const response = await createReq({ name: 'Segundo', document }, adminCookie);
      expect(response.status).toBe(409);
    }
    expect(await countAll()).toBe(1);
  });

  it('rejects an invalid email or an over-length phone or address on suppliers', async () => {
    const cases = [
      { name: 'Fornecedor', email: 'não-é-email' },
      { name: 'Fornecedor', phone: 'x'.repeat(31) },
      { name: 'Fornecedor', address: 'x'.repeat(301) },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects an empty, blank or over-length supplier name', async () => {
    const cases = [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(151) }];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('non-admin roles get 403 on POST /suppliers', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await createReq({ name: 'Fornecedor' }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
    expect(await countAll()).toBe(0);
  });

  it('POST /suppliers without a session is 401', async () => {
    const response = await createReq({ name: 'Fornecedor' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
    expect(await countAll()).toBe(0);
  });

  // S6 - Listar fornecedores com paginação e busca

  it('GET /suppliers returns the first page for every role, ordered by name', async () => {
    await createSupplier(dataSource, { name: 'f31-a' });
    await createSupplier(dataSource, { name: 'f31-b' });
    await createSupplier(dataSource, { name: 'f31-c' });

    for (const cookie of [adminCookie, productionCookie, salesCookie]) {
      const response = await listReq('', cookie);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(20);
      expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
        'f31-a',
        'f31-b',
        'f31-c',
      ]);
    }
  });

  it('searches suppliers by name ignoring case', async () => {
    await createSupplier(dataSource, { name: 'Filamentos ABC' });
    await createSupplier(dataSource, { name: 'filamentos ABC Ltda' });
    await createSupplier(dataSource, { name: 'Resinas XYZ' });

    const response = await listReq('?search=Filamentos', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: { name: string }) => item.name).sort()).toEqual([
      'Filamentos ABC',
      'filamentos ABC Ltda',
    ]);
  });

  it('paginates suppliers with page and pageSize', async () => {
    for (let i = 1; i <= 15; i++) {
      const name = `f33-${String(i).padStart(2, '0')}`;
      await createSupplier(dataSource, { name });
    }

    const response = await listReq('?page=2&pageSize=10', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(15);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
      'f33-11',
      'f33-12',
      'f33-13',
      'f33-14',
      'f33-15',
    ]);
  });

  it('rejects invalid page and pageSize for suppliers', async () => {
    const cases = ['?page=0', '?pageSize=0', '?pageSize=101'];
    for (const query of cases) {
      const response = await listReq(query, adminCookie);
      expect(response.status).toBe(400);
    }
  });

  it('GET /suppliers without a session is 401', async () => {
    const response = await listReq('');
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S7 - Editar fornecedor, só admin

  it('admin patches only the sent fields on a supplier', async () => {
    const id = await createSupplier(dataSource, {
      name: 'f36-original',
      document: null,
      phone: '1133330000',
      email: 'f36@test.local',
      address: 'Rua Dois, 200',
    });

    const response = await patchReq(id, { phone: '1144440000' }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: 'f36-original',
      document: null,
      phone: '1144440000',
      email: 'f36@test.local',
      address: 'Rua Dois, 200',
    });
  });

  it('PATCH suppliers with an unknown id is 404', async () => {
    const response = await patchReq('00000000-0000-0000-0000-000000000000', { name: 'X' }, adminCookie);
    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it('rejects invalid fields on supplier PATCH without changing the record', async () => {
    const id = await createSupplier(dataSource, { name: 'f38-original', email: 'f38@test.local' });

    const cases = [{ document: '11.222.333/0001-00' }, { email: 'não-é-email' }, { name: '' }];
    for (const body of cases) {
      const response = await patchReq(id, body, adminCookie);
      expect(response.status).toBe(400);
    }

    const [row]: Array<{ name: string; email: string }> = await dataSource.query(
      'SELECT name, email FROM suppliers WHERE id = $1',
      [id],
    );
    expect(row).toEqual({ name: 'f38-original', email: 'f38@test.local' });
  });

  it("rejects changing a supplier's document to one already used by another supplier", async () => {
    await createSupplier(dataSource, { name: 'f39-outro', document: '11222333000181' });
    const id = await createSupplier(dataSource, { name: 'f39-alvo', document: null });

    const response = await patchReq(id, { document: '11.222.333/0001-81' }, adminCookie);
    expect(response.status).toBe(409);

    const [row]: Array<{ document: string | null }> = await dataSource.query(
      'SELECT document FROM suppliers WHERE id = $1',
      [id],
    );
    expect(row.document).toBeNull();
  });

  it('non-admin roles get 403 on PATCH /suppliers', async () => {
    const id = await createSupplier(dataSource, { name: 'f40-original' });
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await patchReq(id, { name: 'X' }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
  });

  it('PATCH /suppliers without a session is 401', async () => {
    const id = await createSupplier(dataSource, { name: 'f41-original' });
    const response = await patchReq(id, { name: 'X' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S8 - Ativar e desativar fornecedor

  it('deactivates a supplier without deleting it', async () => {
    const id = await createSupplier(dataSource, { name: 'f42-active' });

    const response = await patchReq(id, { active: false }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);

    const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM suppliers WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('reactivates an inactive supplier', async () => {
    const id = await createSupplier(dataSource, { name: 'f43-inactive', active: false });

    const response = await patchReq(id, { active: true }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(true);
  });

  it('DELETE /suppliers/:id does not exist', async () => {
    const id = await createSupplier(dataSource, { name: 'f44-no-delete' });
    const response = await request(server()).delete(`/suppliers/${id}`).set('Cookie', adminCookie);
    expect(response.status).toBe(404);
  });
});
