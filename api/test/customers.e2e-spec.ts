import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createCustomer } from './customers-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const NOT_FOUND = { error: 'Cliente não encontrado' };

const EMAILS = ['cust-admin@test.local', 'cust-production@test.local', 'cust-sales@test.local'];

describe('Customers (e2e)', () => {
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
    await dataSource.query('DELETE FROM customers');
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // Sem unicidade de name, a tabela inteira é o escopo de isolamento mais simples entre testes.
  beforeEach(async () => {
    await dataSource.query('DELETE FROM customers');
  });

  const server = () => app.getHttpServer();
  const createReq = (body: object, cookie?: string) => {
    const call = request(server()).post('/customers').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const listReq = (query: string, cookie?: string) => {
    const call = request(server()).get(`/customers${query}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/customers/${id}`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const countAll = async () => {
    const rows: Array<{ count: string }> = await dataSource.query('SELECT count(*) FROM customers');
    return Number(rows[0]?.count ?? 0);
  };

  // S1 - Cadastrar cliente, admin e vendas

  it('admin and sales create a customer with only name filled', async () => {
    for (const cookie of [adminCookie, salesCookie]) {
      const response = await createReq({ name: '  Ana Silva  ' }, cookie);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Ana Silva',
        document: null,
        phone: null,
        email: null,
        address: null,
        active: true,
      });
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id.length).toBeGreaterThan(0);
      await dataSource.query('DELETE FROM customers');
    }
  });

  it('stores document as digits only for a valid CPF and CNPJ', async () => {
    const cases = [
      { document: '123.456.789-09', digits: '12345678909' },
      { document: '11.222.333/0001-81', digits: '11222333000181' },
    ];
    for (const { document, digits } of cases) {
      const response = await createReq({ name: 'Cliente doc', document }, adminCookie);
      expect(response.status).toBe(201);
      expect(response.body.document).toBe(digits);
      await dataSource.query('DELETE FROM customers');
    }
  });

  it('rejects a document with the wrong length, an invalid check digit or a repeated-digit sequence', async () => {
    const cases = [
      '1234567890',
      '123456789012345',
      '123.456.789-00',
      '11.222.333/0001-00',
      '111.111.111-11',
      '11.111.111/1111-11',
    ];
    for (const document of cases) {
      const response = await createReq({ name: 'Cliente inválido', document }, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects a duplicate document even with different formatting', async () => {
    const first = await createReq({ name: 'Primeiro', document: '123.456.789-09' }, adminCookie);
    expect(first.status).toBe(201);

    const cases = ['123.456.789-09', '12345678909'];
    for (const document of cases) {
      const response = await createReq({ name: 'Segundo', document }, adminCookie);
      expect(response.status).toBe(409);
    }
    expect(await countAll()).toBe(1);
  });

  it('rejects an invalid email or an over-length phone or address', async () => {
    const cases = [
      { name: 'Cliente', email: 'não-é-email' },
      { name: 'Cliente', phone: 'x'.repeat(31) },
      { name: 'Cliente', address: 'x'.repeat(301) },
    ];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('rejects an empty, blank or over-length name', async () => {
    const cases = [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(151) }];
    for (const body of cases) {
      const response = await createReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countAll()).toBe(0);
  });

  it('production gets 403 on POST /customers', async () => {
    const response = await createReq({ name: 'Cliente' }, productionCookie);
    expect(response.status).toBe(403);
    expect(response.body).toEqual(PERMISSION_DENIED);
    expect(await countAll()).toBe(0);
  });

  it('POST /customers without a session is 401', async () => {
    const response = await createReq({ name: 'Cliente' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
    expect(await countAll()).toBe(0);
  });

  // S2 - Listar clientes com paginação e busca

  it('GET /customers returns the first page for every role, ordered by name', async () => {
    await createCustomer(dataSource, { name: 'c9-a' });
    await createCustomer(dataSource, { name: 'c9-b' });
    await createCustomer(dataSource, { name: 'c9-c' });

    for (const cookie of [adminCookie, productionCookie, salesCookie]) {
      const response = await listReq('', cookie);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(20);
      expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
        'c9-a',
        'c9-b',
        'c9-c',
      ]);
    }
  });

  it('searches customers by name ignoring case', async () => {
    await createCustomer(dataSource, { name: 'Ana Silva' });
    await createCustomer(dataSource, { name: 'ana silva Filmes' });
    await createCustomer(dataSource, { name: 'João Pereira' });

    const response = await listReq('?search=Silva', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: { name: string }) => item.name).sort()).toEqual([
      'Ana Silva',
      'ana silva Filmes',
    ]);
  });

  it('paginates customers with page and pageSize', async () => {
    for (let i = 1; i <= 15; i++) {
      const name = `c11-${String(i).padStart(2, '0')}`;
      await createCustomer(dataSource, { name });
    }

    const response = await listReq('?page=2&pageSize=10', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(15);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
      'c11-11',
      'c11-12',
      'c11-13',
      'c11-14',
      'c11-15',
    ]);
  });

  it('rejects invalid page and pageSize for customers', async () => {
    const cases = ['?page=0', '?pageSize=0', '?pageSize=101'];
    for (const query of cases) {
      const response = await listReq(query, adminCookie);
      expect(response.status).toBe(400);
    }
  });

  it('GET /customers without a session is 401', async () => {
    const response = await listReq('');
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S3 - Editar cliente, admin e vendas

  it('admin and sales patch only the sent fields on a customer', async () => {
    for (const cookie of [adminCookie, salesCookie]) {
      const id = await createCustomer(dataSource, {
        name: 'c14-original',
        document: null,
        phone: '11999990000',
        email: 'c14@test.local',
        address: 'Rua Um, 100',
      });

      const response = await patchReq(id, { phone: '11888880000' }, cookie);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'c14-original',
        document: null,
        phone: '11888880000',
        email: 'c14@test.local',
        address: 'Rua Um, 100',
      });
      await dataSource.query('DELETE FROM customers');
    }
  });

  it('PATCH customers with an unknown id is 404', async () => {
    const response = await patchReq('00000000-0000-0000-0000-000000000000', { name: 'X' }, adminCookie);
    expect(response.status).toBe(404);
    expect(response.body).toEqual(NOT_FOUND);
  });

  it('rejects invalid fields on customer PATCH without changing the record', async () => {
    const id = await createCustomer(dataSource, { name: 'c16-original', email: 'c16@test.local' });

    const cases = [{ document: '123.456.789-00' }, { email: 'não-é-email' }, { name: '' }];
    for (const body of cases) {
      const response = await patchReq(id, body, adminCookie);
      expect(response.status).toBe(400);
    }

    const [row]: Array<{ name: string; email: string }> = await dataSource.query(
      'SELECT name, email FROM customers WHERE id = $1',
      [id],
    );
    expect(row).toEqual({ name: 'c16-original', email: 'c16@test.local' });
  });

  it("rejects changing a customer's document to one already used by another customer", async () => {
    await createCustomer(dataSource, { name: 'c17-outro', document: '12345678909' });
    const id = await createCustomer(dataSource, { name: 'c17-alvo', document: null });

    const response = await patchReq(id, { document: '123.456.789-09' }, adminCookie);
    expect(response.status).toBe(409);

    const [row]: Array<{ document: string | null }> = await dataSource.query(
      'SELECT document FROM customers WHERE id = $1',
      [id],
    );
    expect(row.document).toBeNull();
  });

  it('production gets 403 on PATCH /customers', async () => {
    const id = await createCustomer(dataSource, { name: 'c18-original' });
    const response = await patchReq(id, { name: 'X' }, productionCookie);
    expect(response.status).toBe(403);
    expect(response.body).toEqual(PERMISSION_DENIED);
  });

  it('PATCH /customers without a session is 401', async () => {
    const id = await createCustomer(dataSource, { name: 'c19-original' });
    const response = await patchReq(id, { name: 'X' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  // S4 - Ativar e desativar cliente

  it('deactivates a customer without deleting it', async () => {
    const id = await createCustomer(dataSource, { name: 'c20-active' });

    const response = await patchReq(id, { active: false }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);

    const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM customers WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('reactivates an inactive customer', async () => {
    const id = await createCustomer(dataSource, { name: 'c21-inactive', active: false });

    const response = await patchReq(id, { active: true }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(true);
  });

  it('DELETE /customers/:id does not exist', async () => {
    const id = await createCustomer(dataSource, { name: 'c22-no-delete' });
    const response = await request(server()).delete(`/customers/${id}`).set('Cookie', adminCookie);
    expect(response.status).toBe(404);
  });
});
