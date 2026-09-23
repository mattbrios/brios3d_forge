import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createMaterial } from './materials-helper.js';
import { createRoll } from './inventory-helper.js';
import { createPrinter } from './printers-helper.js';
import { createStockItem, createItemMovement, linkPrinter, userIdOf } from './stock-items-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const ITEM_NOT_FOUND = { error: 'Item não encontrado' };

const EMAILS = [
  'items-admin@test.local',
  'items-production@test.local',
  'items-sales@test.local',
  'items-production2@test.local',
];
const UNKNOWN_ITEM_ID = '00000000-0000-4000-8000-000000000010';
const UNKNOWN_SUPPLIER_ID = '00000000-0000-4000-8000-000000000011';
const UNKNOWN_PRINTER_ID = '00000000-0000-4000-8000-000000000012';
const MALFORMED_ID = 'nao-e-uuid';

const VALID_ITEM = { category: 'insumo', name: 'Parafuso M3x8', unitOfMeasure: 'un' };

describe('Stock items (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;
  let productionCookie: string;
  let salesCookie: string;
  let production2Cookie: string;
  let adminId: string;
  let productionId: string;
  let production2Id: string;

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
    await createUser(dataSource, { email: EMAILS[3], role: 'production' });
    adminCookie = await loginCookie(app.getHttpServer(), EMAILS[0]);
    productionCookie = await loginCookie(app.getHttpServer(), EMAILS[1]);
    salesCookie = await loginCookie(app.getHttpServer(), EMAILS[2]);
    production2Cookie = await loginCookie(app.getHttpServer(), EMAILS[3]);
    adminId = await userIdOf(dataSource, EMAILS[0]);
    productionId = await userIdOf(dataSource, EMAILS[1]);
    production2Id = await userIdOf(dataSource, EMAILS[3]);
  });

  afterAll(async () => {
    await cleanup();
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // As FKs obrigam a ordem: movimentos antes dos donos, vínculos antes das impressoras.
  async function cleanup(): Promise<void> {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM stock_item_printers');
    await dataSource.query('DELETE FROM stock_items');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
    await dataSource.query('DELETE FROM printers');
    await dataSource.query('DELETE FROM suppliers');
  }

  beforeEach(cleanup);

  const server = () => app.getHttpServer();
  const withCookie = (call: request.Test, cookie?: string) => (cookie ? call.set('Cookie', cookie) : call);

  const createItemReq = (body: object, cookie?: string) =>
    withCookie(request(server()).post('/inventory/items').send(body), cookie);
  const updateItemReq = (id: string, body: object, cookie?: string) =>
    withCookie(request(server()).patch(`/inventory/items/${id}`).send(body), cookie);
  const listItemsReq = (query: string, cookie?: string) =>
    withCookie(request(server()).get(`/inventory/items${query}`), cookie);
  const getItemReq = (id: string, cookie?: string) =>
    withCookie(request(server()).get(`/inventory/items/${id}`), cookie);
  const entryReq = (id: string, body: object, cookie?: string) =>
    withCookie(request(server()).post(`/inventory/items/${id}/entries`).send(body), cookie);
  const itemMovementReq = (id: string, body: object, cookie?: string) =>
    withCookie(request(server()).post(`/inventory/items/${id}/movements`).send(body), cookie);
  const countReq = (id: string, body: object, cookie?: string) =>
    withCookie(request(server()).patch(`/inventory/items/${id}/count`).send(body), cookie);
  const listMovementsReq = (query: string, cookie?: string) =>
    withCookie(request(server()).get(`/inventory/movements${query}`), cookie);

  const countItems = async (): Promise<number> => {
    const rows: Array<{ c: string }> = await dataSource.query('SELECT COUNT(*)::text AS c FROM stock_items');
    return Number(rows[0].c);
  };
  const countAllMovements = async (): Promise<number> => {
    const rows: Array<{ c: string }> = await dataSource.query(
      'SELECT COUNT(*)::text AS c FROM inventory_movements',
    );
    return Number(rows[0].c);
  };
  const movementsOfItem = async (stockItemId: string): Promise<Array<Record<string, unknown>>> =>
    dataSource.query(
      'SELECT * FROM inventory_movements WHERE stock_item_id = $1 ORDER BY created_at ASC, id ASC',
      [stockItemId],
    );
  const balanceOfItem = async (id: string): Promise<number> => {
    const rows: Array<{ balance_quantity: string }> = await dataSource.query(
      'SELECT balance_quantity FROM stock_items WHERE id = $1',
      [id],
    );
    return Number(rows[0].balance_quantity);
  };
  const linksOfItem = async (id: string): Promise<string[]> => {
    const rows: Array<{ printer_id: string }> = await dataSource.query(
      'SELECT printer_id FROM stock_item_printers WHERE stock_item_id = $1 ORDER BY printer_id ASC',
      [id],
    );
    return rows.map((row) => row.printer_id);
  };
  const countAllLinks = async (): Promise<number> => {
    const rows: Array<{ c: string }> = await dataSource.query(
      'SELECT COUNT(*)::text AS c FROM stock_item_printers',
    );
    return Number(rows[0].c);
  };

  // S1 - Cadastro de item

  it('creates a stock item with zero balance and no ledger movement', async () => {
    const response = await createItemReq(VALID_ITEM, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      category: 'insumo',
      name: 'Parafuso M3x8',
      unitOfMeasure: 'un',
      balanceQuantity: 0,
      avgCostCents: null,
      active: true,
    });
    // Door 6: o cadastro não é um lote, então não nasce nenhum movimento.
    expect(await movementsOfItem(response.body.id as string)).toHaveLength(0);
    expect(await countAllMovements()).toBe(0);
  });

  it('rejects an unknown category, an empty name or an empty unit of measure', async () => {
    const cases = [
      { ...VALID_ITEM, category: 'consumivel' },
      { ...VALID_ITEM, name: '' },
      { ...VALID_ITEM, unitOfMeasure: '' },
    ];
    for (const body of cases) {
      const response = await createItemReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countItems()).toBe(0);
  });

  it('rejects a duplicate sku on create and on update', async () => {
    const first = await createItemReq({ ...VALID_ITEM, sku: 'SKU-1' }, adminCookie);
    expect(first.status).toBe(201);
    const second = await createItemReq({ ...VALID_ITEM, name: 'Ímã 6x3', sku: 'SKU-2' }, adminCookie);
    expect(second.status).toBe(201);

    const onCreate = await createItemReq({ ...VALID_ITEM, name: 'Outro', sku: 'SKU-1' }, adminCookie);
    expect(onCreate.status).toBe(409);

    const onUpdate = await updateItemReq(second.body.id as string, { sku: 'SKU-1' }, adminCookie);
    expect(onUpdate.status).toBe(409);

    // O item que já tinha o sku não foi alterado por nenhuma das duas tentativas.
    const rows: Array<{ sku: string }> = await dataSource.query('SELECT sku FROM stock_items ORDER BY sku ASC');
    expect(rows.map((row) => row.sku)).toEqual(['SKU-1', 'SKU-2']);
  });

  it('accepts two items without sku', async () => {
    const first = await createItemReq({ ...VALID_ITEM, name: 'Lixa 220' }, adminCookie);
    const second = await createItemReq({ ...VALID_ITEM, name: 'Lixa 400' }, adminCookie);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.sku).toBeNull();
    expect(second.body.sku).toBeNull();

    const list = await listItemsReq('', adminCookie);
    expect(list.body.total).toBe(2);
    expect((list.body.items as Array<{ id: string }>).map((item) => item.id).sort()).toEqual(
      [first.body.id as string, second.body.id as string].sort(),
    );
  });

  it('rejects an unknown preferredSupplierId', async () => {
    const response = await createItemReq(
      { ...VALID_ITEM, preferredSupplierId: UNKNOWN_SUPPLIER_ID },
      adminCookie,
    );
    expect(response.status).toBe(400);
    expect(await countItems()).toBe(0);
  });

  it('deactivating an item keeps the row and its history', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 100 });
    await createItemMovement(dataSource, {
      stockItemId: itemId,
      type: 'entrada',
      quantity: 100,
      unitCostCents: 50,
      userId: adminId,
    });

    const response = await updateItemReq(itemId, { active: false }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);

    const list = await listItemsReq('', adminCookie);
    expect((list.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([itemId]);
    const detail = await getItemReq(itemId, adminCookie);
    expect(detail.body.movements).toHaveLength(1);
    expect(await countItems()).toBe(1);
  });

  it('no route exists to physically delete a stock item', async () => {
    const itemId = await createStockItem(dataSource);
    const routes = [`/inventory/items/${itemId}`, '/inventory/items'];
    for (const route of routes) {
      const response = await request(server()).delete(route).set('Cookie', adminCookie);
      expect(response.status).toBe(404);
    }
    expect(await countItems()).toBe(1);
  });

  it('production and sales get 403 on create and update', async () => {
    const itemId = await createStockItem(dataSource, { name: 'Ímã 6x3' });
    for (const cookie of [productionCookie, salesCookie]) {
      const created = await createItemReq(VALID_ITEM, cookie);
      expect(created.status).toBe(403);
      expect(created.body).toEqual(PERMISSION_DENIED);

      const updated = await updateItemReq(itemId, { name: 'mudado' }, cookie);
      expect(updated.status).toBe(403);
      expect(updated.body).toEqual(PERMISSION_DENIED);
    }
    expect(await countItems()).toBe(1);
    const rows: Array<{ name: string }> = await dataSource.query('SELECT name FROM stock_items');
    expect(rows[0].name).toBe('Ímã 6x3');
  });

  it('GET /inventory/items filters by category with the AD-020 pagination envelope', async () => {
    await createStockItem(dataSource, { category: 'insumo', name: 'Cola' });
    const partId = await createStockItem(dataSource, { category: 'peca_reposicao', name: 'Bico 0.4' });

    const response = await listItemsReq('?category=peca_reposicao', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect((response.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([partId]);
  });

  it('GET /inventory/items searches name and sku case-insensitively', async () => {
    const byName = await createStockItem(dataSource, { name: 'Primer Cinza', sku: 'AAA-1' });
    const bySku = await createStockItem(dataSource, { name: 'Cola CA', sku: 'BICO-04' });

    const nameHit = await listItemsReq('?search=primer', adminCookie);
    expect(nameHit.status).toBe(200);
    expect((nameHit.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([byName]);

    const skuHit = await listItemsReq('?search=bico-04', adminCookie);
    expect(skuHit.status).toBe(200);
    expect((skuHit.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([bySku]);
  });

  it('production and sales get 200 on every read route', async () => {
    const itemId = await createStockItem(dataSource);
    for (const cookie of [productionCookie, salesCookie]) {
      expect((await listItemsReq('', cookie)).status).toBe(200);
      expect((await getItemReq(itemId, cookie)).status).toBe(200);
      expect((await listMovementsReq('', cookie)).status).toBe(200);
    }
  });

  it('rejects a pageSize above the AD-020 maximum', async () => {
    expect((await listItemsReq('?pageSize=101', adminCookie)).status).toBe(400);
    expect((await listMovementsReq('?pageSize=101', adminCookie)).status).toBe(400);
  });

  // S2 - Entrada com custo e custo médio ponderado

  it('an entry writes an item-owned entrada movement and adds to the balance', async () => {
    const itemId = await createStockItem(dataSource);

    const response = await entryReq(itemId, { quantity: 100, unitCostCents: 50 }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.balanceQuantity).toBe(100);

    const movements = await movementsOfItem(itemId);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'entrada', stock_item_id: itemId, roll_id: null });
    expect(Number(movements[0].quantity)).toBe(100);
    expect(Number(movements[0].unit_cost_cents)).toBe(50);
  });

  it('rejects a non-positive entry quantity or a negative unit cost', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 10 });
    const cases = [
      { quantity: 0, unitCostCents: 50 },
      { quantity: -1, unitCostCents: 50 },
      { quantity: 10, unitCostCents: -1 },
    ];
    for (const body of cases) {
      const response = await entryReq(itemId, body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await balanceOfItem(itemId)).toBe(10);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  it('two entries at different prices average to 60 weighted by quantity', async () => {
    const itemId = await createStockItem(dataSource);
    expect((await entryReq(itemId, { quantity: 100, unitCostCents: 50 }, adminCookie)).status).toBe(201);
    expect((await entryReq(itemId, { quantity: 100, unitCostCents: 70 }, adminCookie)).status).toBe(201);

    const response = await getItemReq(itemId, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ balanceQuantity: 200, avgCostCents: 60 });
  });

  it('a consumo leaves the average cost untouched', async () => {
    const itemId = await createStockItem(dataSource);
    await entryReq(itemId, { quantity: 100, unitCostCents: 50 }, adminCookie);
    await entryReq(itemId, { quantity: 100, unitCostCents: 70 }, adminCookie);

    expect(
      (await itemMovementReq(itemId, { type: 'consumo', quantity: 150 }, productionCookie)).status,
    ).toBe(201);

    const response = await getItemReq(itemId, adminCookie);
    expect(response.body).toMatchObject({ balanceQuantity: 50, avgCostCents: 60 });
  });

  it('an entry after a consumo moves the average to 80', async () => {
    const itemId = await createStockItem(dataSource);
    await entryReq(itemId, { quantity: 100, unitCostCents: 50 }, adminCookie);
    await entryReq(itemId, { quantity: 100, unitCostCents: 70 }, adminCookie);
    await itemMovementReq(itemId, { type: 'consumo', quantity: 150 }, productionCookie);

    expect((await entryReq(itemId, { quantity: 50, unitCostCents: 100 }, adminCookie)).status).toBe(201);

    const response = await getItemReq(itemId, adminCookie);
    expect(response.body).toMatchObject({ balanceQuantity: 100, avgCostCents: 80 });
  });

  it('reports a null average cost when the balance reaches zero', async () => {
    const itemId = await createStockItem(dataSource);
    await entryReq(itemId, { quantity: 40, unitCostCents: 90 }, adminCookie);
    await itemMovementReq(itemId, { type: 'consumo', quantity: 40 }, productionCookie);

    const response = await getItemReq(itemId, adminCookie);
    expect(response.body).toMatchObject({ balanceQuantity: 0, avgCostCents: null });
  });

  it('rejects an entry on an inactive item', async () => {
    const itemId = await createStockItem(dataSource, { active: false, balanceQuantity: 5 });

    const response = await entryReq(itemId, { quantity: 10, unitCostCents: 50 }, adminCookie);
    expect(response.status).toBe(400);
    expect(await balanceOfItem(itemId)).toBe(5);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  it('production and sales get 403 on POST entries', async () => {
    const itemId = await createStockItem(dataSource);
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await entryReq(itemId, { quantity: 10, unitCostCents: 50 }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
    expect(await balanceOfItem(itemId)).toBe(0);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  // S3 - Consumo e perda

  it('consumo and perda movements decrement the item balance', async () => {
    for (const type of ['consumo', 'perda']) {
      const itemId = await createStockItem(dataSource, { balanceQuantity: 500 });
      const response = await itemMovementReq(itemId, { type, quantity: 200 }, productionCookie);
      expect(response.status).toBe(201);
      expect(response.body.balanceQuantity).toBe(300);

      const movements = await movementsOfItem(itemId);
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ type, unit_cost_cents: null });
      expect(Number(movements[0].quantity)).toBe(-200);
    }
  });

  it('rejects a movement quantity greater than the item balance', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 100 });

    const response = await itemMovementReq(itemId, { type: 'consumo', quantity: 150 }, productionCookie);
    expect(response.status).toBe(400);
    expect(await balanceOfItem(itemId)).toBe(100);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  it('only one of two concurrent item movements that would exceed the balance succeeds', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 100 });

    const [first, second] = await Promise.all([
      itemMovementReq(itemId, { type: 'consumo', quantity: 70 }, productionCookie),
      itemMovementReq(itemId, { type: 'consumo', quantity: 70 }, productionCookie),
    ]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);
    expect(await balanceOfItem(itemId)).toBe(30);
    expect(await movementsOfItem(itemId)).toHaveLength(1);
  });

  it('rejects entrada and ajuste on the movements route', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 100 });
    for (const type of ['entrada', 'ajuste']) {
      const response = await itemMovementReq(itemId, { type, quantity: 10 }, productionCookie);
      expect(response.status).toBe(400);
    }
    expect(await balanceOfItem(itemId)).toBe(100);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  it('sales gets 403 on POST movements', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 100 });

    const response = await itemMovementReq(itemId, { type: 'consumo', quantity: 10 }, salesCookie);
    expect(response.status).toBe(403);
    expect(response.body).toEqual(PERMISSION_DENIED);
    expect(await balanceOfItem(itemId)).toBe(100);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  // S4 - Contagem de inventário

  it('counting 45 against a balance of 50 writes an ajuste of -5', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 50 });

    const response = await countReq(itemId, { countedQuantity: 45 }, productionCookie);
    expect(response.status).toBe(200);
    expect(response.body.balanceQuantity).toBe(45);

    const movements = await movementsOfItem(itemId);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'ajuste' });
    expect(Number(movements[0].quantity)).toBe(-5);
  });

  it('a count with no difference still records a zero ajuste', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 50 });

    const response = await countReq(itemId, { countedQuantity: 50 }, productionCookie);
    expect(response.status).toBe(200);
    expect(response.body.balanceQuantity).toBe(50);

    const movements = await movementsOfItem(itemId);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'ajuste' });
    expect(Number(movements[0].quantity)).toBe(0);
  });

  it('rejects a negative counted quantity', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 50 });

    const response = await countReq(itemId, { countedQuantity: -1 }, productionCookie);
    expect(response.status).toBe(400);
    expect(await balanceOfItem(itemId)).toBe(50);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  it('sales gets 403 on PATCH count', async () => {
    const itemId = await createStockItem(dataSource, { balanceQuantity: 50 });

    const response = await countReq(itemId, { countedQuantity: 10 }, salesCookie);
    expect(response.status).toBe(403);
    expect(response.body).toEqual(PERMISSION_DENIED);
    expect(await balanceOfItem(itemId)).toBe(50);
    expect(await movementsOfItem(itemId)).toHaveLength(0);
  });

  // S5 - Compatibilidade da peça com impressoras

  it('a spare part stores one compatibility link per printer', async () => {
    const printerA = await createPrinter(dataSource, { name: 'X1C' });
    const printerB = await createPrinter(dataSource, { name: 'A1 mini' });

    const response = await createItemReq(
      {
        category: 'peca_reposicao',
        name: 'Bico 0.4 hardened',
        unitOfMeasure: 'un',
        compatiblePrinterIds: [printerA, printerB],
      },
      adminCookie,
    );
    expect(response.status).toBe(201);
    expect((response.body.compatiblePrinterIds as string[]).slice().sort()).toEqual(
      [printerA, printerB].sort(),
    );
    expect(await linksOfItem(response.body.id as string)).toHaveLength(2);
  });

  it('rejects compatiblePrinterIds on a consumable', async () => {
    const printerA = await createPrinter(dataSource, { name: 'X1C' });
    const itemId = await createStockItem(dataSource, { category: 'insumo', name: 'Cola CA' });

    const created = await createItemReq(
      { ...VALID_ITEM, compatiblePrinterIds: [printerA] },
      adminCookie,
    );
    expect(created.status).toBe(400);

    const updated = await updateItemReq(itemId, { compatiblePrinterIds: [printerA] }, adminCookie);
    expect(updated.status).toBe(400);

    expect(await countAllLinks()).toBe(0);
  });

  it('rejects the whole set when one printer id is unknown', async () => {
    const printerA = await createPrinter(dataSource, { name: 'X1C' });
    const partId = await createStockItem(dataSource, { category: 'peca_reposicao', name: 'Correia' });

    const created = await createItemReq(
      {
        category: 'peca_reposicao',
        name: 'PTFE',
        unitOfMeasure: 'm',
        compatiblePrinterIds: [printerA, UNKNOWN_PRINTER_ID],
      },
      adminCookie,
    );
    expect(created.status).toBe(400);

    const updated = await updateItemReq(
      partId,
      { compatiblePrinterIds: [printerA, UNKNOWN_PRINTER_ID] },
      adminCookie,
    );
    expect(updated.status).toBe(400);

    // Nem o id válido do conjunto fica persistido.
    expect(await countAllLinks()).toBe(0);
  });

  it('PATCH replaces the compatibility set instead of appending', async () => {
    const printerA = await createPrinter(dataSource, { name: 'X1C' });
    const printerB = await createPrinter(dataSource, { name: 'A1 mini' });
    const partId = await createStockItem(dataSource, { category: 'peca_reposicao', name: 'Placa PEI' });
    await linkPrinter(dataSource, partId, printerA);
    await linkPrinter(dataSource, partId, printerB);

    const response = await updateItemReq(partId, { compatiblePrinterIds: [printerB] }, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.compatiblePrinterIds).toEqual([printerB]);
    expect(await linksOfItem(partId)).toEqual([printerB]);
  });

  it('PATCH without compatiblePrinterIds keeps the existing links', async () => {
    const printerA = await createPrinter(dataSource, { name: 'X1C' });
    const printerB = await createPrinter(dataSource, { name: 'A1 mini' });
    const partId = await createStockItem(dataSource, { category: 'peca_reposicao', name: 'Hotend' });
    await linkPrinter(dataSource, partId, printerA);
    await linkPrinter(dataSource, partId, printerB);

    const response = await updateItemReq(partId, { location: 'gaveta 2' }, adminCookie);
    expect(response.status).toBe(200);
    expect((response.body.compatiblePrinterIds as string[]).slice().sort()).toEqual(
      [printerA, printerB].sort(),
    );
    expect(await linksOfItem(partId)).toHaveLength(2);
  });

  // S6 - Ledger único, histórico unificado e auditoria

  it('GET /inventory/movements lists roll and item movements in one ordered page', async () => {
    const materialId = await createMaterial(dataSource, { type: `PLA-${Date.now()}` });
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 500 });
    const itemId = await createStockItem(dataSource, { balanceQuantity: 100 });

    expect((await entryReq(itemId, { quantity: 20, unitCostCents: 30 }, adminCookie)).status).toBe(201);
    expect(
      (
        await request(server())
          .post(`/inventory/rolls/${rollId}/movements`)
          .set('Cookie', productionCookie)
          .send({ type: 'consumo', quantity: 50 })
      ).status,
    ).toBe(201);

    const response = await listMovementsReq('', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });

    const items = response.body.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    const timestamps = items.map((item) => new Date(item.createdAt as string).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));

    const rollMovement = items.find((item) => item.rollId === rollId);
    const itemMovement = items.find((item) => item.stockItemId === itemId);
    expect(rollMovement).toMatchObject({ type: 'consumo', quantity: -50, stockItemId: null });
    expect(itemMovement).toMatchObject({ type: 'entrada', quantity: 20, unitCostCents: 30, rollId: null });
    for (const movement of items) {
      expect(movement).toHaveProperty('reason');
      expect(movement).toHaveProperty('userId');
      // Dono único (door 3): exatamente um dos dois ids vem preenchido.
      expect([movement.rollId, movement.stockItemId].filter((owner) => owner !== null)).toHaveLength(1);
    }
  });

  it('GET /inventory/items/:id returns the item with its ordered movement history', async () => {
    const printerA = await createPrinter(dataSource, { name: 'X1C' });
    const itemId = await createStockItem(dataSource, { category: 'peca_reposicao', name: 'Bico 0.6' });
    await linkPrinter(dataSource, itemId, printerA);

    await entryReq(itemId, { quantity: 10, unitCostCents: 500 }, adminCookie);
    await itemMovementReq(itemId, { type: 'consumo', quantity: 4, reason: 'troca na X1C' }, productionCookie);
    await countReq(itemId, { countedQuantity: 5 }, productionCookie);

    const response = await getItemReq(itemId, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      balanceQuantity: 5,
      avgCostCents: 500,
      compatiblePrinterIds: [printerA],
    });

    const movements = response.body.movements as Array<Record<string, unknown>>;
    expect(movements.map((movement) => movement.type)).toEqual(['entrada', 'consumo', 'ajuste']);
    const timestamps = movements.map((movement) => new Date(movement.createdAt as string).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    for (const movement of movements) {
      expect(movement).toHaveProperty('quantity');
      expect(movement).toHaveProperty('unitCostCents');
      expect(movement).toHaveProperty('reason');
      expect(movement).toHaveProperty('userId');
    }
    expect(movements[1].reason).toBe('troca na X1C');
  });

  it('records the acting user on every item movement type', async () => {
    const itemId = await createStockItem(dataSource);
    await entryReq(itemId, { quantity: 100, unitCostCents: 50 }, adminCookie);
    await itemMovementReq(itemId, { type: 'consumo', quantity: 10 }, productionCookie);
    await itemMovementReq(itemId, { type: 'perda', quantity: 5 }, productionCookie);
    await countReq(itemId, { countedQuantity: 80 }, production2Cookie);

    const movements = await movementsOfItem(itemId);
    expect(movements.map((movement) => [movement.type, movement.user_id])).toEqual([
      ['entrada', adminId],
      ['consumo', productionId],
      ['perda', productionId],
      ['ajuste', production2Id],
    ]);
  });

  it('the database rejects a movement with two owners or none', async () => {
    const materialId = await createMaterial(dataSource, { type: `PETG-${Date.now()}` });
    const rollId = await createRoll(dataSource, { materialId });
    const itemId = await createStockItem(dataSource);

    const insertRaw = async (
      roll: string | null,
      item: string | null,
    ): Promise<{ code: string; constraint: string }> => {
      try {
        await dataSource.query(
          `INSERT INTO inventory_movements (roll_id, stock_item_id, type, quantity, user_id)
           VALUES ($1, $2, 'consumo', -1, $3)`,
          [roll, item, adminId],
        );
        return { code: 'accepted', constraint: 'none' };
      } catch (error) {
        const driverError = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
        return { code: driverError?.code ?? 'unknown', constraint: driverError?.constraint ?? 'unknown' };
      }
    };

    // Os dois lados da violação do XOR (door 3): dois donos e nenhum dono.
    expect(await insertRaw(rollId, itemId)).toEqual({ code: '23514', constraint: 'movement_single_owner' });
    expect(await insertRaw(null, null)).toEqual({ code: '23514', constraint: 'movement_single_owner' });
    expect(await countAllMovements()).toBe(0);
  });

  it('no route exists to edit or delete a movement of either owner', async () => {
    const materialId = await createMaterial(dataSource, { type: `ABS-${Date.now()}` });
    const rollId = await createRoll(dataSource, { materialId });
    const itemId = await createStockItem(dataSource);
    const movementId = await createItemMovement(dataSource, {
      stockItemId: itemId,
      type: 'entrada',
      quantity: 10,
      unitCostCents: 5,
      userId: adminId,
    });

    const routes = [
      `/inventory/items/${itemId}/movements/${movementId}`,
      `/inventory/rolls/${rollId}/movements/${movementId}`,
    ];
    for (const route of routes) {
      expect((await request(server()).patch(route).set('Cookie', adminCookie)).status).toBe(404);
      expect((await request(server()).delete(route).set('Cookie', adminCookie)).status).toBe(404);
    }
    expect(await countAllMovements()).toBe(1);
  });

  // S8 - Regras cruzadas de rota: sessão, id e o corpo renomeado

  it('every new inventory route is 401 without a session', async () => {
    const routes: Array<() => Promise<{ status: number; body: unknown }>> = [
      () => createItemReq(VALID_ITEM),
      () => updateItemReq(UNKNOWN_ITEM_ID, { name: 'x' }),
      () => listItemsReq(''),
      () => getItemReq(UNKNOWN_ITEM_ID),
      () => entryReq(UNKNOWN_ITEM_ID, { quantity: 1, unitCostCents: 1 }),
      () => itemMovementReq(UNKNOWN_ITEM_ID, { type: 'consumo', quantity: 1 }),
      () => countReq(UNKNOWN_ITEM_ID, { countedQuantity: 1 }),
      () => listMovementsReq(''),
    ];
    expect(routes).toHaveLength(8);
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(401);
      expect(response.body).toEqual(SESSION_REQUIRED);
    }
  });

  it('every item-scoped route is 404 for an unknown item id', async () => {
    const routes: Array<() => Promise<{ status: number; body: unknown }>> = [
      () => updateItemReq(UNKNOWN_ITEM_ID, { name: 'x' }, adminCookie),
      () => getItemReq(UNKNOWN_ITEM_ID, adminCookie),
      () => entryReq(UNKNOWN_ITEM_ID, { quantity: 1, unitCostCents: 1 }, adminCookie),
      () => itemMovementReq(UNKNOWN_ITEM_ID, { type: 'consumo', quantity: 1 }, productionCookie),
      () => countReq(UNKNOWN_ITEM_ID, { countedQuantity: 1 }, productionCookie),
    ];
    expect(routes).toHaveLength(5);
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(404);
      expect(response.body).toEqual(ITEM_NOT_FOUND);
    }
  });

  it('every id-scoped route is 400 for a malformed uuid', async () => {
    const routes: Array<() => Promise<{ status: number }>> = [
      () => updateItemReq(MALFORMED_ID, { name: 'x' }, adminCookie),
      () => getItemReq(MALFORMED_ID, adminCookie),
      () => entryReq(MALFORMED_ID, { quantity: 1, unitCostCents: 1 }, adminCookie),
      () => itemMovementReq(MALFORMED_ID, { type: 'consumo', quantity: 1 }, productionCookie),
      () => countReq(MALFORMED_ID, { countedQuantity: 1 }, productionCookie),
      () => withCookie(request(server()).get(`/inventory/rolls/${MALFORMED_ID}`), adminCookie),
    ];
    expect(routes).toHaveLength(6);
    for (const route of routes) {
      expect((await route()).status).toBe(400);
    }
  });
});
