import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createMaterial } from './materials-helper.js';
import { createMovement, createRoll } from './inventory-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const ROLL_NOT_FOUND = { error: 'Rolo não encontrado' };

const EMAILS = ['inv-admin@test.local', 'inv-production@test.local', 'inv-sales@test.local'];
const UNKNOWN_ROLL_ID = '00000000-0000-4000-8000-000000000000';
const UNKNOWN_MATERIAL_ID = '00000000-0000-4000-8000-000000000001';
const UNKNOWN_SUPPLIER_ID = '00000000-0000-4000-8000-000000000002';

const VALID_ROLL = {
  initialWeightGrams: 1000,
  spoolTareGrams: 250,
  acquisitionCostCents: 12000,
};

describe('Inventory (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;
  let productionCookie: string;
  let salesCookie: string;
  let materialId: string;
  let inactiveMaterialId: string;

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
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  // A FK obriga a apagar os movimentos antes dos rolos; os materiais ficam entre testes
  // (nenhum check exercita o cadastro de material em si, só a referência por FK).
  beforeEach(async () => {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
    materialId = await createMaterial(dataSource, { type: `PLA-${Date.now()}` });
    inactiveMaterialId = await createMaterial(dataSource, { type: `ABS-${Date.now()}`, active: false });
  });

  const server = () => app.getHttpServer();
  const createRollReq = (body: object, cookie?: string) => {
    const call = request(server()).post('/inventory/rolls').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const listReq = (query: string, cookie?: string) => {
    const call = request(server()).get(`/inventory/rolls${query}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const getByIdReq = (id: string, cookie?: string) => {
    const call = request(server()).get(`/inventory/rolls/${id}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const weighReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).patch(`/inventory/rolls/${id}/weigh`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const movementReq = (id: string, body: object, cookie?: string) => {
    const call = request(server()).post(`/inventory/rolls/${id}/movements`).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const discardReq = (id: string, cookie?: string) => {
    const call = request(server()).patch(`/inventory/rolls/${id}/discard`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const openReq = (id: string, cookie?: string) => {
    const call = request(server()).patch(`/inventory/rolls/${id}/open`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const dryReq = (id: string, cookie?: string) => {
    const call = request(server()).patch(`/inventory/rolls/${id}/dry`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const summaryReq = (query: string, cookie?: string) => {
    const call = request(server()).get(`/inventory/materials-summary${query}`);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const countRolls = async () => {
    const rows: Array<{ c: string }> = await dataSource.query('SELECT COUNT(*)::text AS c FROM filament_rolls');
    return Number(rows[0].c);
  };
  const movementsOf = async (rollId: string): Promise<Array<Record<string, unknown>>> =>
    dataSource.query('SELECT * FROM inventory_movements WHERE roll_id = $1 ORDER BY created_at ASC', [rollId]);
  const balanceOf = async (rollId: string): Promise<number> => {
    const rows: Array<{ balance_grams: string }> = await dataSource.query(
      'SELECT balance_grams FROM filament_rolls WHERE id = $1',
      [rollId],
    );
    return Number(rows[0].balance_grams);
  };

  // S1 - Entrada manual de rolo (admin)

  it('creates a roll with the first entrada movement and the derived closed status', async () => {
    const response = await createRollReq({ ...VALID_ROLL, materialId }, adminCookie);
    expect(response.status).toBe(201);
    expect(response.body.balanceGrams).toBe(1000);
    expect(response.body.status).toBe('fechado');

    const movements = await movementsOf(response.body.id as string);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'entrada', quantity: 1000 });
    expect(Number(movements[0].unit_cost_cents)).toBe(12);
  });

  it('rejects an unknown or inactive materialId', async () => {
    const cases = [UNKNOWN_MATERIAL_ID, inactiveMaterialId];
    for (const badMaterialId of cases) {
      const response = await createRollReq({ ...VALID_ROLL, materialId: badMaterialId }, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countRolls()).toBe(0);
  });

  it('rejects an unknown supplierId', async () => {
    const response = await createRollReq(
      { ...VALID_ROLL, materialId, supplierId: UNKNOWN_SUPPLIER_ID },
      adminCookie,
    );
    expect(response.status).toBe(400);
    expect(await countRolls()).toBe(0);
  });

  it('rejects a non-positive initial weight, a negative tare or a negative cost', async () => {
    const cases = [
      { ...VALID_ROLL, materialId, initialWeightGrams: 0 },
      { ...VALID_ROLL, materialId, spoolTareGrams: -1 },
      { ...VALID_ROLL, materialId, acquisitionCostCents: -1 },
    ];
    for (const body of cases) {
      const response = await createRollReq(body, adminCookie);
      expect(response.status).toBe(400);
    }
    expect(await countRolls()).toBe(0);
  });

  it('production and sales get 403 on POST /inventory/rolls', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const response = await createRollReq({ ...VALID_ROLL, materialId }, cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual(PERMISSION_DENIED);
    }
    expect(await countRolls()).toBe(0);
  });

  // S2 - Saldo e custo médio por material

  it('GET /inventory/rolls filters by materialId with the AD-020 pagination envelope', async () => {
    const otherMaterialId = await createMaterial(dataSource, { type: `PETG-${Date.now()}` });
    const rollId = await createRoll(dataSource, { materialId });
    await createRoll(dataSource, { materialId: otherMaterialId });

    const response = await listReq(`?materialId=${materialId}`, adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(rollId);
  });

  it('production and sales get 200 on every read route', async () => {
    const rollId = await createRoll(dataSource, { materialId });
    for (const cookie of [productionCookie, salesCookie]) {
      expect((await listReq('', cookie)).status).toBe(200);
      expect((await getByIdReq(rollId, cookie)).status).toBe(200);
      expect((await summaryReq('', cookie)).status).toBe(200);
    }
  });

  it('GET /inventory/rolls filters by status and by search across batch and location', async () => {
    const closedId = await createRoll(dataSource, { materialId, batch: 'lote-x' });
    const openId = await createRoll(dataSource, { materialId, openedAt: new Date(), location: 'prateleira-x' });

    const byStatus = await listReq('?status=aberto', adminCookie);
    expect(byStatus.status).toBe(200);
    expect((byStatus.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([openId]);

    const byBatch = await listReq('?search=lote-x', adminCookie);
    expect((byBatch.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([closedId]);

    const byLocation = await listReq('?search=prateleira-x', adminCookie);
    expect((byLocation.body.items as Array<{ id: string }>).map((item) => item.id)).toEqual([openId]);
  });

  it('materials-summary averages two rolls of the same material weighted by balance', async () => {
    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 10000 });
    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 12000 });

    const response = await summaryReq('', adminCookie);
    expect(response.status).toBe(200);
    const item = (response.body.items as Array<{ materialId: string }>).find((row) => row.materialId === materialId);
    expect(item).toMatchObject({ totalBalanceGrams: 2000, avgCostCentsPerGram: 11, rollCount: 2 });
  });

  it('materials-summary reports null average cost when nothing is in stock', async () => {
    await createRoll(dataSource, { materialId, balanceGrams: 0 });

    const response = await summaryReq('', adminCookie);
    expect(response.status).toBe(200);
    const item = (response.body.items as Array<{ materialId: string }>).find((row) => row.materialId === materialId);
    expect(item).toMatchObject({ totalBalanceGrams: 0, avgCostCentsPerGram: null, rollCount: 1 });
  });

  it('does not add stock or cost fields to GET /materials', async () => {
    const rollId = await createRoll(dataSource, { materialId });
    await createMovement(dataSource, {
      rollId,
      type: 'entrada',
      quantity: 1000,
      unitCostCents: 12,
      userId: (await loginUserId(dataSource, EMAILS[0])) as string,
    });

    const response = await request(server()).get('/materials?pageSize=100').set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    const material = (response.body.items as Array<Record<string, unknown>>).find((row) => row.id === materialId);
    expect(material).toBeDefined();
    expect(Object.keys(material as object).sort()).toEqual(
      ['active', 'bedTempC', 'brand', 'color', 'densityGCm3', 'dryingHours', 'dryingTemperatureC', 'id', 'needsDrying', 'nozzleTempC', 'type'].sort(),
    );
  });

  // S3 - Pesagem

  it('weighing 812g gross with a 250g tare leaves the balance at 562g with an ajuste movement', async () => {
    const rollId = await createRoll(dataSource, { materialId, spoolTareGrams: 250, balanceGrams: 600 });

    const response = await weighReq(rollId, { grossWeightGrams: 812 }, productionCookie);
    expect(response.status).toBe(200);
    expect(response.body.balanceGrams).toBe(562);

    const movements = await movementsOf(rollId);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'ajuste', quantity: -38 });
  });

  it("rejects a gross weight below the roll's tare", async () => {
    const rollId = await createRoll(dataSource, { materialId, spoolTareGrams: 250, balanceGrams: 600 });

    const response = await weighReq(rollId, { grossWeightGrams: 100 }, productionCookie);
    expect(response.status).toBe(400);
    expect(await balanceOf(rollId)).toBe(600);
    expect(await movementsOf(rollId)).toHaveLength(0);
  });

  // S4 - Baixa de consumo, perda e descarte

  it('consumo and perda movements decrement the balance', async () => {
    for (const type of ['consumo', 'perda']) {
      const rollId = await createRoll(dataSource, { materialId, balanceGrams: 500 });
      const response = await movementReq(rollId, { type, quantity: 200 }, productionCookie);
      expect(response.status).toBe(201);
      expect(response.body.balanceGrams).toBe(300);
      const movements = await movementsOf(rollId);
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ type, quantity: -200 });
    }
  });

  it('a movement that consumes the whole balance without discarding derives status vazio', async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 200 });

    const response = await movementReq(rollId, { type: 'consumo', quantity: 200 }, productionCookie);
    expect(response.status).toBe(201);
    expect(response.body.balanceGrams).toBe(0);
    expect(response.body.status).toBe('vazio');
    expect(response.body.discardedAt).toBeNull();
  });

  it("rejects a movement quantity greater than the roll's balance", async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 100 });

    const response = await movementReq(rollId, { type: 'consumo', quantity: 150 }, productionCookie);
    expect(response.status).toBe(400);
    expect(await balanceOf(rollId)).toBe(100);
    expect(await movementsOf(rollId)).toHaveLength(0);
  });

  it('only one of two concurrent movements that would exceed the balance succeeds', async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 100 });

    const [first, second] = await Promise.all([
      movementReq(rollId, { type: 'consumo', quantity: 70 }, productionCookie),
      movementReq(rollId, { type: 'consumo', quantity: 70 }, productionCookie),
    ]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);
    expect(await balanceOf(rollId)).toBe(30);
  });

  it('discarding a roll writes a perda movement for the whole remaining balance', async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 200 });

    const response = await discardReq(rollId, productionCookie);
    expect(response.status).toBe(200);
    expect(response.body.balanceGrams).toBe(0);
    expect(response.body.discardedAt).not.toBeNull();
    expect(response.body.status).toBe('descartado');

    const movements = await movementsOf(rollId);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'perda', quantity: -200 });
  });

  // S5 - Abertura e secagem

  it('opening a roll sets openedAt once and is idempotent on a second call', async () => {
    const rollId = await createRoll(dataSource, { materialId });

    const first = await openReq(rollId, productionCookie);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('aberto');
    expect(first.body.openedAt).not.toBeNull();

    const second = await openReq(rollId, productionCookie);
    expect(second.status).toBe(200);
    expect(second.body.openedAt).toBe(first.body.openedAt);
  });

  it('drying a roll always advances lastDriedAt', async () => {
    const rollId = await createRoll(dataSource, { materialId });

    const first = await dryReq(rollId, productionCookie);
    expect(first.status).toBe(200);
    expect(first.body.lastDriedAt).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await dryReq(rollId, productionCookie);
    expect(second.status).toBe(200);
    expect(new Date(second.body.lastDriedAt as string).getTime()).toBeGreaterThan(
      new Date(first.body.lastDriedAt as string).getTime(),
    );
  });

  // S6 - Auditoria e histórico

  it('records the acting user on every movement type', async () => {
    const adminId = await loginUserId(dataSource, EMAILS[0]);
    const productionId = await loginUserId(dataSource, EMAILS[1]);
    const create = await createRollReq({ ...VALID_ROLL, materialId }, adminCookie);
    const rollId = create.body.id as string;
    await weighReq(rollId, { grossWeightGrams: 1100 }, productionCookie);
    await movementReq(rollId, { type: 'consumo', quantity: 100 }, productionCookie);

    const movements = await movementsOf(rollId);
    expect(movements).toHaveLength(3);
    expect(movements[0]).toMatchObject({ type: 'entrada', user_id: adminId });
    expect(movements[1]).toMatchObject({ type: 'ajuste', user_id: productionId });
    expect(movements[2]).toMatchObject({ type: 'consumo', user_id: productionId });
  });

  it('GET /inventory/rolls/:id returns the movement history ordered by createdAt', async () => {
    const create = await createRollReq({ ...VALID_ROLL, materialId }, adminCookie);
    const rollId = create.body.id as string;
    await weighReq(rollId, { grossWeightGrams: 1100 }, productionCookie);
    await movementReq(rollId, { type: 'consumo', quantity: 100 }, productionCookie);

    const response = await getByIdReq(rollId, adminCookie);
    expect(response.status).toBe(200);
    const movements = response.body.movements as Array<Record<string, unknown>>;
    expect(movements).toHaveLength(3);
    expect(movements.map((movement) => movement.type)).toEqual(['entrada', 'ajuste', 'consumo']);
    const timestamps = movements.map((movement) => new Date(movement.createdAt as string).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    for (const movement of movements) {
      expect(movement).toHaveProperty('type');
      expect(movement).toHaveProperty('quantity');
      expect(movement).toHaveProperty('unitCostCents');
      expect(movement).toHaveProperty('reason');
      expect(movement).toHaveProperty('userId');
      expect(movement).toHaveProperty('createdAt');
    }
  });

  // Fase 10, door 4 - o contrato do movimento passou a se chamar quantity/unitCostCents em toda
  // rota, e o risco de regressão está justamente aqui, em código que a Fase 10 não mudaria por
  // outro motivo.

  it('the roll movement history uses the renamed quantity and unitCostCents keys', async () => {
    const create = await createRollReq({ ...VALID_ROLL, materialId }, adminCookie);
    const rollId = create.body.id as string;
    await movementReq(rollId, { type: 'consumo', quantity: 100 }, productionCookie);

    const response = await getByIdReq(rollId, adminCookie);
    expect(response.status).toBe(200);
    const movements = response.body.movements as Array<Record<string, unknown>>;
    expect(movements).toHaveLength(2);
    for (const movement of movements) {
      expect(movement).toHaveProperty('quantity');
      expect(movement).toHaveProperty('unitCostCents');
      expect(movement).not.toHaveProperty('quantityGrams');
      expect(movement).not.toHaveProperty('unitCostCentsPerGram');
    }
    expect(movements[0]).toMatchObject({ type: 'entrada', quantity: 1000, unitCostCents: 12 });
    expect(movements[1]).toMatchObject({ type: 'consumo', quantity: -100, unitCostCents: null });
  });

  it('roll entrada, ajuste and consumo keep the same ledger values after the rename', async () => {
    // Mesmo caso de referência da Fase 9 (1000 g a 12000 centavos, pesagem 812 g com tara 250 g,
    // baixa de 100 g): a renomeação mudou o nome da coluna, nunca o valor gravado.
    const create = await createRollReq({ ...VALID_ROLL, materialId }, adminCookie);
    const rollId = create.body.id as string;
    await weighReq(rollId, { grossWeightGrams: 812 }, productionCookie);
    await movementReq(rollId, { type: 'consumo', quantity: 100 }, productionCookie);

    const movements = await movementsOf(rollId);
    expect(movements.map((movement) => movement.type)).toEqual(['entrada', 'ajuste', 'consumo']);
    expect(movements.map((movement) => Number(movement.quantity))).toEqual([1000, -438, -100]);
    expect(Number(movements[0].unit_cost_cents)).toBe(12);
    expect(movements[1].unit_cost_cents).toBeNull();
    expect(movements[2].unit_cost_cents).toBeNull();
    // Dono único (door 3): o movimento de rolo continua sem `stock_item_id`.
    expect(movements.every((movement) => movement.stock_item_id === null)).toBe(true);
  });

  it('the roll movement route takes quantity and rejects the old quantityGrams key', async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 500 });

    const renamed = await movementReq(rollId, { type: 'consumo', quantity: 50 }, productionCookie);
    expect(renamed.status).toBe(201);
    expect(renamed.body.balanceGrams).toBe(450);

    // A chave antiga passa a ser propriedade não declarada, recusada pelo ValidationPipe (AD-003).
    const oldKey = await movementReq(rollId, { type: 'consumo', quantityGrams: 50 }, productionCookie);
    expect(oldKey.status).toBe(400);
    expect(await balanceOf(rollId)).toBe(450);
  });

  it('no route exists to edit or delete an inventory movement', async () => {
    const rollId = await createRoll(dataSource, { materialId });
    const movementId = await createMovement(dataSource, {
      rollId,
      type: 'entrada',
      quantity: 1000,
      userId: (await loginUserId(dataSource, EMAILS[0])) as string,
    });

    const patch = await request(server())
      .patch(`/inventory/rolls/${rollId}/movements/${movementId}`)
      .set('Cookie', adminCookie);
    expect(patch.status).toBe(404);

    const del = await request(server())
      .delete(`/inventory/rolls/${rollId}/movements/${movementId}`)
      .set('Cookie', adminCookie);
    expect(del.status).toBe(404);
  });

  // S7 - Regras cruzadas de rota: sessão, papel e rolo inexistente

  it('every inventory route is 401 without a session', async () => {
    const routes: Array<() => Promise<{ status: number }>> = [
      () => createRollReq({ ...VALID_ROLL, materialId }),
      () => listReq(''),
      () => getByIdReq(UNKNOWN_ROLL_ID),
      () => weighReq(UNKNOWN_ROLL_ID, { grossWeightGrams: 100 }),
      () => movementReq(UNKNOWN_ROLL_ID, { type: 'consumo', quantity: 1 }),
      () => discardReq(UNKNOWN_ROLL_ID),
      () => openReq(UNKNOWN_ROLL_ID),
      () => dryReq(UNKNOWN_ROLL_ID),
      () => summaryReq(''),
    ];
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(401);
      expect((response as unknown as { body: unknown }).body).toEqual(SESSION_REQUIRED);
    }
  });

  it('every roll-scoped route is 404 for an unknown roll id', async () => {
    const routes: Array<() => Promise<{ status: number }>> = [
      () => getByIdReq(UNKNOWN_ROLL_ID, adminCookie),
      () => weighReq(UNKNOWN_ROLL_ID, { grossWeightGrams: 100 }, productionCookie),
      () => movementReq(UNKNOWN_ROLL_ID, { type: 'consumo', quantity: 1 }, productionCookie),
      () => discardReq(UNKNOWN_ROLL_ID, productionCookie),
      () => openReq(UNKNOWN_ROLL_ID, productionCookie),
      () => dryReq(UNKNOWN_ROLL_ID, productionCookie),
    ];
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(404);
      expect((response as unknown as { body: unknown }).body).toEqual(ROLL_NOT_FOUND);
    }
  });

  it('sales gets 403 on every operational roll route', async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 200 });
    const routes: Array<() => Promise<{ status: number }>> = [
      () => weighReq(rollId, { grossWeightGrams: 100 }, salesCookie),
      () => movementReq(rollId, { type: 'consumo', quantity: 1 }, salesCookie),
      () => discardReq(rollId, salesCookie),
      () => openReq(rollId, salesCookie),
      () => dryReq(rollId, salesCookie),
    ];
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(403);
      expect((response as unknown as { body: unknown }).body).toEqual(PERMISSION_DENIED);
    }
    expect(await balanceOf(rollId)).toBe(200);
  });

  it('every balance-changing route is 409 on an already discarded roll', async () => {
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 0, discardedAt: new Date() });
    const routes: Array<() => Promise<{ status: number }>> = [
      () => weighReq(rollId, { grossWeightGrams: 100 }, productionCookie),
      () => movementReq(rollId, { type: 'consumo', quantity: 1 }, productionCookie),
      () => discardReq(rollId, productionCookie),
    ];
    for (const route of routes) {
      const response = await route();
      expect(response.status).toBe(409);
    }
    expect(await movementsOf(rollId)).toHaveLength(0);
  });
});

async function loginUserId(dataSource: DataSource, email: string): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0].id;
}
