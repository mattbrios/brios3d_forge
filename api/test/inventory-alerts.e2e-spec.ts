import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createRoll } from './inventory-helper.js';
import { createMaterial } from './materials-helper.js';
import { createStockItem } from './stock-items-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const UNKNOWN_UUID = '8f3c1e2a-0000-4000-8000-0000000000ff';

const EMAILS = ['min-admin@test.local', 'min-production@test.local', 'min-sales@test.local'];

const VALID_PLA = {
  type: 'PLA',
  brand: 'Voolt',
  color: 'Preto',
  densityGCm3: 1.24,
  nozzleTempC: 210,
  bedTempC: 60,
  needsDrying: false,
};

const VALID_ITEM = { category: 'insumo' as const, name: 'Ímã 6x3', unitOfMeasure: 'un' };

describe('Stock minimums and alerts (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;
  let productionCookie: string;
  let salesCookie: string;

  async function cleanup(): Promise<void> {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM stock_item_printers');
    await dataSource.query('DELETE FROM stock_items');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
  }

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await cleanup();
    await deleteUsers(dataSource, EMAILS);
    await createUser(dataSource, { email: EMAILS[0], role: 'admin' });
    await createUser(dataSource, { email: EMAILS[1], role: 'production' });
    await createUser(dataSource, { email: EMAILS[2], role: 'sales' });
    adminCookie = await loginCookie(app.getHttpServer(), EMAILS[0]);
    productionCookie = await loginCookie(app.getHttpServer(), EMAILS[1]);
    salesCookie = await loginCookie(app.getHttpServer(), EMAILS[2]);
  });

  afterAll(async () => {
    await cleanup();
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // A rota de alertas lê a tabela inteira de materiais e de itens, então sobra de um teste
  // apareceria na lista do seguinte: a tabela toda é o escopo de isolamento.
  beforeEach(async () => {
    await cleanup();
  });

  const server = () => app.getHttpServer();

  const send = (call: request.Test, cookie?: string) => (cookie ? call.set('Cookie', cookie) : call);

  const postMaterial = (body: object, cookie?: string) =>
    send(request(server()).post('/materials').send(body), cookie);
  const patchMaterial = (id: string, body: object, cookie?: string) =>
    send(request(server()).patch(`/materials/${id}`).send(body), cookie);
  const getMaterials = (query = '', cookie?: string) =>
    send(request(server()).get(`/materials${query}`), cookie);

  const postItem = (body: object, cookie?: string) =>
    send(request(server()).post('/inventory/items').send(body), cookie);
  const patchItem = (id: string, body: object, cookie?: string) =>
    send(request(server()).patch(`/inventory/items/${id}`).send(body), cookie);
  const getItems = (query = '', cookie?: string) =>
    send(request(server()).get(`/inventory/items${query}`), cookie);
  const getItem = (id: string, cookie?: string) =>
    send(request(server()).get(`/inventory/items/${id}`), cookie);

  const getAlerts = (cookie?: string) => send(request(server()).get('/inventory/alerts'), cookie);

  const materialMinimumOf = async (id: string): Promise<number | null> => {
    const rows: Array<{ minimum_stock_grams: number | null }> = await dataSource.query(
      'SELECT minimum_stock_grams FROM materials WHERE id = $1',
      [id],
    );
    return rows[0].minimum_stock_grams;
  };

  const itemMinimumOf = async (id: string): Promise<number | null> => {
    const rows: Array<{ minimum_quantity: number | null }> = await dataSource.query(
      'SELECT minimum_quantity FROM stock_items WHERE id = $1',
      [id],
    );
    return rows[0].minimum_quantity;
  };

  const countItems = async (): Promise<number> => {
    const rows: Array<{ count: string }> = await dataSource.query('SELECT count(*) FROM stock_items');
    return Number(rows[0].count);
  };

  // --- S1: piso por material e por item ---

  it('sets the material minimum to 500 and keeps it on a repeated patch', async () => {
    const id = await createMaterial(dataSource, { type: 'PLA' });

    const first = await patchMaterial(id, { minimumStockGrams: 500 }, adminCookie);
    expect(first.status).toBe(200);
    expect(first.body.minimumStockGrams).toBe(500);
    expect(await materialMinimumOf(id)).toBe(500);

    // Escrita absoluta: repetir o mesmo valor não muda nada.
    const second = await patchMaterial(id, { minimumStockGrams: 500 }, adminCookie);
    expect(second.status).toBe(200);
    expect(second.body.minimumStockGrams).toBe(500);
    expect(await materialMinimumOf(id)).toBe(500);
  });

  it('a material created without a minimum has a null minimumStockGrams', async () => {
    const response = await postMaterial(VALID_PLA, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.minimumStockGrams).toBeNull();
    expect(await materialMinimumOf(response.body.id)).toBeNull();
  });

  it('creates a material with a minimum of 500 grams', async () => {
    const response = await postMaterial({ ...VALID_PLA, minimumStockGrams: 500 }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.minimumStockGrams).toBe(500);
    expect(await materialMinimumOf(response.body.id)).toBe(500);
  });

  it('clearing the material minimum writes null back', async () => {
    const id = await createMaterial(dataSource, { type: 'PLA', minimumStockGrams: 500 });

    const response = await patchMaterial(id, { minimumStockGrams: null }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.minimumStockGrams).toBeNull();
    expect(await materialMinimumOf(id)).toBeNull();
  });

  it('rejects a negative or non-numeric material minimum', async () => {
    const id = await createMaterial(dataSource, { type: 'PLA', minimumStockGrams: 500 });

    for (const invalid of [-1, '500', '', {}]) {
      const response = await patchMaterial(id, { minimumStockGrams: invalid }, adminCookie);
      expect(response.status, JSON.stringify(invalid)).toBe(400);
      expect(typeof response.body.error).toBe('string');
      expect(await materialMinimumOf(id)).toBe(500);
    }
  });

  it('production and sales get 403 setting the material minimum', async () => {
    const id = await createMaterial(dataSource, { type: 'PLA', minimumStockGrams: 500 });

    for (const cookie of [productionCookie, salesCookie]) {
      const response = await patchMaterial(id, { minimumStockGrams: 800 }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
      expect(await materialMinimumOf(id)).toBe(500);
    }
  });

  it('GET /materials returns minimumStockGrams as a number or null', async () => {
    await createMaterial(dataSource, { type: 'ABS', minimumStockGrams: 500 });
    await createMaterial(dataSource, { type: 'PETG' });

    const response = await getMaterials('?pageSize=100', adminCookie);
    expect(response.status).toBe(200);
    const byType = new Map<string, number | null>(
      (response.body.items as Array<{ type: string; minimumStockGrams: number | null }>).map((item) => [
        item.type,
        item.minimumStockGrams,
      ]),
    );
    expect(byType.get('ABS')).toBe(500);
    expect(byType.get('PETG')).toBeNull();
  });

  it('sets the stock item minimum to 10', async () => {
    const id = await createStockItem(dataSource, { name: 'Ímã 6x3' });

    const response = await patchItem(id, { minimumQuantity: 10 }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.minimumQuantity).toBe(10);
    expect(await itemMinimumOf(id)).toBe(10);
  });

  it('creates a stock item with a minimum quantity of 10', async () => {
    const response = await postItem({ ...VALID_ITEM, minimumQuantity: 10 }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.minimumQuantity).toBe(10);
    expect(await itemMinimumOf(response.body.id)).toBe(10);
  });

  it('clearing the item minimum writes null back', async () => {
    const id = await createStockItem(dataSource, { name: 'Ímã 6x3', minimumQuantity: 10 });

    // Corpo exato que a tela do item envia para limpar a política; o simétrico do material é C3.
    const response = await patchItem(id, { minimumQuantity: null }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.minimumQuantity).toBeNull();
    expect(await itemMinimumOf(id)).toBeNull();
  });

  it('rejects a negative or non-numeric item minimum on create and on update', async () => {
    const id = await createStockItem(dataSource, { name: 'Base', minimumQuantity: 10 });
    const itemsBefore = await countItems();

    for (const invalid of [-1, '10']) {
      const created = await postItem({ ...VALID_ITEM, minimumQuantity: invalid }, adminCookie);
      expect(created.status, `POST ${JSON.stringify(invalid)}`).toBe(400);
      expect(typeof created.body.error).toBe('string');
      expect(await countItems()).toBe(itemsBefore);

      const patched = await patchItem(id, { minimumQuantity: invalid }, adminCookie);
      expect(patched.status, `PATCH ${JSON.stringify(invalid)}`).toBe(400);
      expect(typeof patched.body.error).toBe('string');
      expect(await itemMinimumOf(id)).toBe(10);
    }
  });

  it('both item read routes return minimumQuantity as a number or null', async () => {
    const withMinimum = await createStockItem(dataSource, { name: 'Com piso', minimumQuantity: 10 });
    const withoutMinimum = await createStockItem(dataSource, { name: 'Sem piso' });

    const list = await getItems('?pageSize=100', adminCookie);
    expect(list.status).toBe(200);
    const byId = new Map<string, number | null>(
      (list.body.items as Array<{ id: string; minimumQuantity: number | null }>).map((item) => [
        item.id,
        item.minimumQuantity,
      ]),
    );
    expect(byId.get(withMinimum)).toBe(10);
    expect(byId.get(withoutMinimum)).toBeNull();

    const detailWith = await getItem(withMinimum, adminCookie);
    expect(detailWith.status).toBe(200);
    expect(detailWith.body.minimumQuantity).toBe(10);
    const detailWithout = await getItem(withoutMinimum, adminCookie);
    expect(detailWithout.status).toBe(200);
    expect(detailWithout.body.minimumQuantity).toBeNull();
  });

  it('the material patch keeps its inherited 401, 404 and 400 with the new field', async () => {
    const id = await createMaterial(dataSource, { type: 'PLA' });
    const body = { minimumStockGrams: 500 };

    const noSession = await patchMaterial(id, body);
    expect(noSession.status).toBe(401);
    expect(noSession.body).toEqual(SESSION_REQUIRED);

    const unknown = await patchMaterial(UNKNOWN_UUID, body, adminCookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Material não encontrado' });

    const notUuid = await patchMaterial('nao-e-uuid', body, adminCookie);
    expect(notUuid.status).toBe(400);
    expect(typeof notUuid.body.error).toBe('string');
  });

  it('the item patch keeps its inherited 401, 403, 404, 400 and 409 with the new field', async () => {
    const id = await createStockItem(dataSource, { name: 'Alvo' });
    await createStockItem(dataSource, { name: 'Dono do sku', sku: 'SKU-EXISTENTE' });
    const body = { minimumQuantity: 10 };

    const noSession = await patchItem(id, body);
    expect(noSession.status).toBe(401);
    expect(noSession.body).toEqual(SESSION_REQUIRED);

    const asSales = await patchItem(id, body, salesCookie);
    expect(asSales.status).toBe(403);
    expect(asSales.body).toEqual(PERMISSION_DENIED);

    const unknown = await patchItem(UNKNOWN_UUID, body, adminCookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Item não encontrado' });

    const notUuid = await patchItem('nao-e-uuid', body, adminCookie);
    expect(notUuid.status).toBe(400);
    expect(typeof notUuid.body.error).toBe('string');

    const duplicate = await patchItem(id, { ...body, sku: 'SKU-EXISTENTE' }, adminCookie);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'Já existe um item com este SKU' });
  });

  it('both create routes keep their inherited 401, 403 and 409 with the new field', async () => {
    await createStockItem(dataSource, { name: 'Dono do sku', sku: 'SKU-EXISTENTE' });

    const materialNoSession = await postMaterial({ ...VALID_PLA, minimumStockGrams: 500 });
    expect(materialNoSession.status).toBe(401);
    expect(materialNoSession.body).toEqual(SESSION_REQUIRED);

    const itemNoSession = await postItem({ ...VALID_ITEM, minimumQuantity: 10 });
    expect(itemNoSession.status).toBe(401);
    expect(itemNoSession.body).toEqual(SESSION_REQUIRED);

    const materialAsProduction = await postMaterial(
      { ...VALID_PLA, minimumStockGrams: 500 },
      productionCookie,
    );
    expect(materialAsProduction.status).toBe(403);
    expect(materialAsProduction.body).toEqual(PERMISSION_DENIED);

    const itemAsProduction = await postItem({ ...VALID_ITEM, minimumQuantity: 10 }, productionCookie);
    expect(itemAsProduction.status).toBe(403);
    expect(itemAsProduction.body).toEqual(PERMISSION_DENIED);

    const duplicate = await postItem(
      { ...VALID_ITEM, minimumQuantity: 10, sku: 'SKU-EXISTENTE' },
      adminCookie,
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'Já existe um item com este SKU' });
  });

  it('the changed read routes keep their inherited statuses', async () => {
    const itemId = await createStockItem(dataSource, { name: 'Alvo', minimumQuantity: 10 });

    const materialsNoSession = await getMaterials('');
    expect(materialsNoSession.status).toBe(401);
    expect(materialsNoSession.body).toEqual(SESSION_REQUIRED);
    const materialsOverPageSize = await getMaterials('?pageSize=101', adminCookie);
    expect(materialsOverPageSize.status).toBe(400);
    expect(typeof materialsOverPageSize.body.error).toBe('string');

    const itemsNoSession = await getItems('');
    expect(itemsNoSession.status).toBe(401);
    expect(itemsNoSession.body).toEqual(SESSION_REQUIRED);
    const itemsOverPageSize = await getItems('?pageSize=101', adminCookie);
    expect(itemsOverPageSize.status).toBe(400);
    expect(typeof itemsOverPageSize.body.error).toBe('string');

    const detailNoSession = await getItem(itemId);
    expect(detailNoSession.status).toBe(401);
    expect(detailNoSession.body).toEqual(SESSION_REQUIRED);
    const detailUnknown = await getItem(UNKNOWN_UUID, adminCookie);
    expect(detailUnknown.status).toBe(404);
    expect(detailUnknown.body).toEqual({ error: 'Item não encontrado' });
    const detailNotUuid = await getItem('nao-e-uuid', adminCookie);
    expect(detailNotUuid.status).toBe(400);
    expect(typeof detailNotUuid.body.error).toBe('string');
  });

  // --- S2: alertas na API ---

  it('reports a material alert with the summed balance, the label and the gram unit', async () => {
    const materialId = await createMaterial(dataSource, {
      type: 'PLA',
      brand: 'Voolt',
      color: 'Preto',
      minimumStockGrams: 1000,
    });
    await createRoll(dataSource, { materialId, balanceGrams: 500 });
    await createRoll(dataSource, { materialId, balanceGrams: 300 });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    // Envelope sem `total`/`page`/`pageSize` (door 4): a lista não pagina.
    expect(Object.keys(response.body)).toEqual(['items']);
    expect(response.body.items).toEqual([
      {
        kind: 'material',
        id: materialId,
        label: 'PLA · Voolt · Preto',
        balance: 800,
        minimum: 1000,
        unit: 'g',
      },
    ]);
  });

  it('alerts at 999 against a minimum of 1000 and stays silent at 1000 and 1001', async () => {
    for (const balance of [999, 1000, 1001]) {
      await cleanup();
      const materialId = await createMaterial(dataSource, {
        type: 'PLA',
        minimumStockGrams: 1000,
      });
      await createRoll(dataSource, { materialId, initialWeightGrams: 1100, balanceGrams: balance });

      const response = await getAlerts(adminCookie);
      expect(response.status).toBe(200);
      const ids = (response.body.items as Array<{ id: string }>).map((alert) => alert.id);
      expect(ids, `saldo ${balance}`).toEqual(balance === 999 ? [materialId] : []);
    }
  });

  it('returns an empty list when no minimum is set anywhere', async () => {
    const materialId = await createMaterial(dataSource, { type: 'PLA' });
    await createRoll(dataSource, { materialId, balanceGrams: 0 });
    await createStockItem(dataSource, { name: 'Sem piso', balanceQuantity: 0 });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('a material with a minimum and no roll alerts with a zero balance', async () => {
    const materialId = await createMaterial(dataSource, {
      type: 'PLA',
      brand: 'Voolt',
      color: 'Preto',
      minimumStockGrams: 500,
    });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        kind: 'material',
        id: materialId,
        label: 'PLA · Voolt · Preto',
        balance: 0,
        minimum: 500,
        unit: 'g',
      },
    ]);
  });

  it('a discarded roll does not count toward the material balance', async () => {
    const materialId = await createMaterial(dataSource, {
      type: 'PLA',
      minimumStockGrams: 1000,
    });
    await createRoll(dataSource, { materialId, balanceGrams: 800 });
    await createRoll(dataSource, { materialId, balanceGrams: 500, discardedAt: new Date() });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].balance).toBe(800);
  });

  it('a material without a minimum never alerts, not even at zero balance', async () => {
    const materialId = await createMaterial(dataSource, { type: 'PLA' });
    await createRoll(dataSource, { materialId, balanceGrams: 0 });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('an inactive material never alerts', async () => {
    const materialId = await createMaterial(dataSource, {
      type: 'PLA',
      minimumStockGrams: 1000,
      active: false,
    });
    await createRoll(dataSource, { materialId, balanceGrams: 0 });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('an inactive stock item never alerts', async () => {
    await createStockItem(dataSource, {
      name: 'Ímã 6x3',
      minimumQuantity: 10,
      balanceQuantity: 0,
      active: false,
    });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('reports a stock item alert with its name as label and its own unit of measure', async () => {
    const itemId = await createStockItem(dataSource, {
      name: 'Ímã 6x3',
      unitOfMeasure: 'un',
      minimumQuantity: 10,
      balanceQuantity: 4,
    });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      { kind: 'stock_item', id: itemId, label: 'Ímã 6x3', balance: 4, minimum: 10, unit: 'un' },
    ]);
  });

  it('orders alerts by the fraction of the minimum missing, not by the absolute shortfall', async () => {
    // Falta 100% do piso: 500 g de 500. Pela falta absoluta este seria o maior (500 g), e pela
    // fração também - o que distingue os dois é a ordem dos outros dois.
    const emptyMaterialId = await createMaterial(dataSource, {
      type: 'ABS',
      minimumStockGrams: 500,
    });
    // Falta 60%: 4 de 10 un. Falta absoluta: 6.
    const itemId = await createStockItem(dataSource, {
      name: 'Ímã 6x3',
      minimumQuantity: 10,
      balanceQuantity: 4,
    });
    // Falta 20%: 800 g de 1000. Falta absoluta: 200 g - maior que os 6 un do item.
    const lowMaterialId = await createMaterial(dataSource, {
      type: 'PLA',
      minimumStockGrams: 1000,
    });
    await createRoll(dataSource, { materialId: lowMaterialId, balanceGrams: 800 });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect((response.body.items as Array<{ id: string }>).map((alert) => alert.id)).toEqual([
      emptyMaterialId,
      itemId,
      lowMaterialId,
    ]);
  });

  it('breaks an ordering tie by label ascending', async () => {
    await createStockItem(dataSource, { name: 'Zinco', minimumQuantity: 10, balanceQuantity: 5 });
    await createStockItem(dataSource, { name: 'Alumínio', minimumQuantity: 10, balanceQuantity: 5 });

    const response = await getAlerts(adminCookie);
    expect(response.status).toBe(200);
    expect((response.body.items as Array<{ label: string }>).map((alert) => alert.label)).toEqual([
      'Alumínio',
      'Zinco',
    ]);
  });

  it('an entry that reaches the minimum removes the item from the alert list', async () => {
    const itemId = await createStockItem(dataSource, {
      name: 'Ímã 6x3',
      minimumQuantity: 10,
      balanceQuantity: 4,
    });

    const before = await getAlerts(adminCookie);
    expect((before.body.items as Array<{ id: string }>).map((alert) => alert.id)).toEqual([itemId]);

    const entry = await send(
      request(server()).post(`/inventory/items/${itemId}/entries`).send({ quantity: 6, unitCostCents: 50 }),
      adminCookie,
    );
    expect(entry.status).toBe(201);
    expect(entry.body.balanceQuantity).toBe(10);

    const after = await getAlerts(adminCookie);
    expect(after.status).toBe(200);
    expect(after.body.items).toEqual([]);
  });

  it('production and sales get the same alert list as admin', async () => {
    const materialId = await createMaterial(dataSource, {
      type: 'PLA',
      brand: 'Voolt',
      color: 'Preto',
      minimumStockGrams: 1000,
    });
    await createRoll(dataSource, { materialId, balanceGrams: 800 });
    const itemId = await createStockItem(dataSource, {
      name: 'Ímã 6x3',
      minimumQuantity: 10,
      balanceQuantity: 4,
    });

    const expected = [
      { kind: 'stock_item', id: itemId, label: 'Ímã 6x3', balance: 4, minimum: 10, unit: 'un' },
      {
        kind: 'material',
        id: materialId,
        label: 'PLA · Voolt · Preto',
        balance: 800,
        minimum: 1000,
        unit: 'g',
      },
    ];

    const asAdmin = await getAlerts(adminCookie);
    expect(asAdmin.body.items).toEqual(expected);

    for (const cookie of [productionCookie, salesCookie]) {
      const response = await getAlerts(cookie);
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual(expected);
    }
  });

  it('GET /inventory/alerts is 401 without a session', async () => {
    const response = await getAlerts();
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });
});
