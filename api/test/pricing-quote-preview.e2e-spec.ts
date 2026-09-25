import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PricingService } from '../src/modules/pricing/pricing.service.js';
import type { PricingInput } from '../src/modules/pricing/pricing.types.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createRoll } from './inventory-helper.js';
import { createMaterial } from './materials-helper.js';
import { createPrinter } from './printers-helper.js';
import { createSalesChannel, deleteSalesChannels, resetSettings } from './settings-helper.js';
import { createItemMovement, createStockItem, userIdOf } from './stock-items-helper.js';

const SESSION_REQUIRED = { error: 'Sessão expirada ou inexistente. Entre novamente' };

const EMAILS = ['quote-preview-admin@test.local', 'quote-preview-production@test.local', 'quote-preview-sales@test.local'];
const CHANNEL_NAMES = ['qp-canal-1', 'qp-canal-2'];

const LABOR = { prepHours: 0.25, slicingHours: 0.25, postProcessingHours: 0.5, centsPerHour: 3000 };

describe('POST /pricing/quote-preview (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminCookie: string;
  let productionCookie: string;
  let salesCookie: string;
  let userId: string;

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
    userId = await userIdOf(dataSource, EMAILS[0]);
    await resetSettings(dataSource, {
      energyTariffCentsPerKwh: 80,
      maintenanceCentsPerHour: 50,
      defaultMarginRate: 0.3,
      failureRate: 0.1,
      purgeRate: 0.05,
      productiveHoursPerMonth: 300,
    });
  });

  // As FKs obrigam a ordem: movimentos antes dos donos (mesmo padrão de stock-items.e2e-spec.ts).
  async function cleanup(): Promise<void> {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM stock_items');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
    await dataSource.query('DELETE FROM printers');
    await deleteSalesChannels(dataSource, [...CHANNEL_NAMES, 'qp-canal-alto']);
  }

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    // Arquivos que mexem em `settings` restauram os defaults no próprio afterAll (mesma regra
    // de settings.e2e-spec.ts): esta suíte muda a margem/tarifas para calcular, e outras suítes
    // (settings.e2e-spec.ts) esperam a linha semeada em zero.
    await resetSettings(dataSource);
    await deleteUsers(dataSource, EMAILS);
    await app.close();
  });

  const post = (body: unknown, cookie: string) =>
    request(app.getHttpServer()).post('/pricing/quote-preview').set('Cookie', cookie).send(body as object);

  const errorOf = (response: { body: unknown }): string => (response.body as { error: string }).error;

  // Fixtures de cadastro compartilhadas entre os casos de sucesso: material com custo médio de
  // 11 centavos/g (mesmo caso de referência de C8 da Fase 9), impressora e canal.
  async function seedBaseFixtures() {
    const materialId = await createMaterial(dataSource, { type: 'PLA' });
    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 10000 });
    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 12000 });
    const printerId = await createPrinter(dataSource, {
      name: `Impressora QP ${Math.random()}`,
      acquisitionCostCents: 400000,
      lifespanHours: 5000,
      powerWatts: 250,
    });
    const channelId = await createSalesChannel(dataSource, { name: CHANNEL_NAMES[0], taxRate: 0, feeRate: 0 });
    return { materialId, printerId, channelId };
  }

  function baseBody(fixtures: { materialId: string; printerId: string; channelId: string }) {
    return {
      printerId: fixtures.printerId,
      materials: [{ materialId: fixtures.materialId, grams: 100 }],
      supplies: [],
      printHours: 5,
      labor: LABOR,
      quantity: 1,
      channelIds: [fixtures.channelId],
    };
  }

  it("calculates using the material's current average cost per gram", async () => {
    const fixtures = await seedBaseFixtures();
    const response = await post(baseBody(fixtures), adminCookie);
    expect(response.status).toBe(200);

    const expected = new PricingService().calculate({
      quantity: 1,
      printHours: 5,
      materials: [{ grams: 100, costPerGramCents: 11 }],
      printer: { powerWatts: 250, costCents: 400000, lifespanHours: 5000 },
      energyTariffCentsPerKwh: 80,
      maintenanceCentsPerHour: 50,
      labor: LABOR,
      supplies: [],
      fixedCosts: { monthlyCents: 0, productiveHoursPerMonth: 300 },
      purgeRate: 0.05,
      failureRate: 0.1,
      marginRate: 0.3,
      taxRate: 0,
      minimumOrderCents: 0,
      channels: [{ name: 'qp-canal-1', feeRate: 0 }],
    } satisfies PricingInput);

    expect((response.body as { costs: unknown }).costs).toEqual(expected.costs);
    expect((response.body as { costs: { materialCents: number } }).costs.materialCents).toBe(
      expected.costs.materialCents,
    );
  });

  it("calculates using the stock item's current average cost", async () => {
    const fixtures = await seedBaseFixtures();
    const stockItemId = await createStockItem(dataSource, { name: 'Parafuso QP' });
    await createItemMovement(dataSource, { stockItemId, type: 'entrada', quantity: 10, unitCostCents: 500, userId });

    const body = { ...baseBody(fixtures), supplies: [{ stockItemId, quantity: 2 }] };
    const response = await post(body, adminCookie);
    expect(response.status).toBe(200);

    const expected = new PricingService().calculate({
      quantity: 1,
      printHours: 5,
      materials: [{ grams: 100, costPerGramCents: 11 }],
      printer: { powerWatts: 250, costCents: 400000, lifespanHours: 5000 },
      energyTariffCentsPerKwh: 80,
      maintenanceCentsPerHour: 50,
      labor: LABOR,
      supplies: [{ quantity: 2, unitCostCents: 500 }],
      fixedCosts: { monthlyCents: 0, productiveHoursPerMonth: 300 },
      purgeRate: 0.05,
      failureRate: 0.1,
      marginRate: 0.3,
      taxRate: 0,
      minimumOrderCents: 0,
      channels: [{ name: 'qp-canal-1', feeRate: 0 }],
    } satisfies PricingInput);

    expect((response.body as { costs: { suppliesCents: number } }).costs.suppliesCents).toBe(
      expected.costs.suppliesCents,
    );
  });

  it('returns a channel price for each channelId requested', async () => {
    const fixtures = await seedBaseFixtures();
    const secondChannelId = await createSalesChannel(dataSource, { name: CHANNEL_NAMES[1], taxRate: 0, feeRate: 0.1 });

    const body = { ...baseBody(fixtures), channelIds: [fixtures.channelId, secondChannelId] };
    const response = await post(body, adminCookie);
    expect(response.status).toBe(200);
    const channels = response.body.channels as Array<{
      name: string;
      unitPriceCents: number;
      totalPriceCents: number;
      minimumPriceApplied: boolean;
    }>;
    expect(channels).toHaveLength(2);
    for (const channel of channels) {
      expect(channel).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          unitPriceCents: expect.any(Number),
          totalPriceCents: expect.any(Number),
          minimumPriceApplied: expect.any(Boolean),
        }),
      );
    }
  });

  it('rejects a material with no average cost with its name in the message', async () => {
    const fixtures = await seedBaseFixtures();
    const discardedMaterialId = await createMaterial(dataSource, { type: 'PETG', brand: 'Marca Sem Custo', color: 'Azul' });
    const rollId = (
      await request(app.getHttpServer())
        .post('/inventory/rolls')
        .set('Cookie', adminCookie)
        .send({ materialId: discardedMaterialId, initialWeightGrams: 1000, spoolTareGrams: 250, acquisitionCostCents: 10000 })
    ).body.id as string;
    await request(app.getHttpServer()).patch(`/inventory/rolls/${rollId}/discard`).set('Cookie', adminCookie);

    const body = { ...baseBody(fixtures), materials: [{ materialId: discardedMaterialId, grams: 100 }] };
    const response = await post(body, adminCookie);
    expect(response.status).toBe(400);
    expect(errorOf(response)).toBe('Material sem custo médio disponível: PETG · Marca Sem Custo · Azul');
  });

  it('rejects a stock item with no average cost with its name in the message', async () => {
    const fixtures = await seedBaseFixtures();
    const stockItemId = await createStockItem(dataSource, { name: 'Insumo Sem Custo QP' });

    const body = { ...baseBody(fixtures), supplies: [{ stockItemId, quantity: 1 }] };
    const response = await post(body, adminCookie);
    expect(response.status).toBe(400);
    expect(errorOf(response)).toBe('Insumo sem custo médio disponível: Insumo Sem Custo QP');
  });

  it('returns 404 with the id in the message for an unknown printer, material, stock item or channel', async () => {
    const fixtures = await seedBaseFixtures();
    const unknownId = '00000000-0000-0000-0000-000000000000';

    const printerCase = await post({ ...baseBody(fixtures), printerId: unknownId }, adminCookie);
    expect(printerCase.status).toBe(404);
    expect(errorOf(printerCase)).toBe(`Impressora ${unknownId} não encontrada`);

    const materialCase = await post(
      { ...baseBody(fixtures), materials: [{ materialId: unknownId, grams: 100 }] },
      adminCookie,
    );
    expect(materialCase.status).toBe(404);
    expect(errorOf(materialCase)).toBe(`Material ${unknownId} não encontrado`);

    const stockItemCase = await post(
      { ...baseBody(fixtures), supplies: [{ stockItemId: unknownId, quantity: 1 }] },
      adminCookie,
    );
    expect(stockItemCase.status).toBe(404);
    expect(errorOf(stockItemCase)).toBe(`Insumo ${unknownId} não encontrado`);

    const channelCase = await post({ ...baseBody(fixtures), channelIds: [unknownId] }, adminCookie);
    expect(channelCase.status).toBe(404);
    expect(errorOf(channelCase)).toBe(`Canal ${unknownId} não encontrado`);
  });

  it('surfaces the same PricingError message as /pricing/calculate for a channel at or above 100%', async () => {
    const fixtures = await seedBaseFixtures();
    await resetSettings(dataSource, {
      energyTariffCentsPerKwh: 80,
      maintenanceCentsPerHour: 50,
      defaultMarginRate: 0.5,
      failureRate: 0.1,
      purgeRate: 0.05,
      productiveHoursPerMonth: 300,
    });
    const highFeeChannelId = await createSalesChannel(dataSource, {
      name: 'qp-canal-alto',
      taxRate: 0.3,
      feeRate: 0.2,
    });

    const body = { ...baseBody(fixtures), channelIds: [highFeeChannelId] };
    const response = await post(body, adminCookie);
    expect(response.status).toBe(400);
    expect(errorOf(response)).toBe('Channel "qp-canal-alto": margin + taxes + fee must be below 100%');

    await deleteSalesChannels(dataSource, ['qp-canal-alto']);
    await resetSettings(dataSource, {
      energyTariffCentsPerKwh: 80,
      maintenanceCentsPerHour: 50,
      defaultMarginRate: 0.3,
      failureRate: 0.1,
      purgeRate: 0.05,
      productiveHoursPerMonth: 300,
    });
  });

  it('echoes the resolved names of every material, supply, printer and channel used', async () => {
    const fixtures = await seedBaseFixtures();
    const stockItemId = await createStockItem(dataSource, { name: 'Insumo Ecoado QP' });
    await createItemMovement(dataSource, { stockItemId, type: 'entrada', quantity: 5, unitCostCents: 300, userId });

    const printerName = await request(app.getHttpServer())
      .get('/printers')
      .set('Cookie', adminCookie)
      .then((res) => (res.body.items as Array<{ id: string; name: string }>).find((p) => p.id === fixtures.printerId)?.name);

    const body = { ...baseBody(fixtures), supplies: [{ stockItemId, quantity: 1 }] };
    const response = await post(body, adminCookie);
    expect(response.status).toBe(200);

    expect(response.body.printer).toEqual({ id: fixtures.printerId, name: printerName });
    expect(response.body.materials).toEqual([
      { materialId: fixtures.materialId, name: 'PLA · Marca de teste · Natural', avgCostCentsPerGram: 11 },
    ]);
    expect(response.body.supplies).toEqual([{ stockItemId, name: 'Insumo Ecoado QP', avgCostCents: 300 }]);
    const channels = response.body.channels as Array<{ id: string; name: string }>;
    expect(channels[0]).toMatchObject({ id: fixtures.channelId, name: 'qp-canal-1' });
  });

  it('production and sales get 200 like admin', async () => {
    for (const cookie of [productionCookie, salesCookie]) {
      const fixtures = await seedBaseFixtures();
      const response = await post(baseBody(fixtures), cookie);
      expect(response.status, cookie).toBe(200);
      await deleteSalesChannels(dataSource, CHANNEL_NAMES);
    }
  });

  it('is 401 without a session', async () => {
    const fixtures = await seedBaseFixtures();
    const response = await request(app.getHttpServer()).post('/pricing/quote-preview').send(baseBody(fixtures));
    expect(response.status).toBe(401);
    expect(response.body).toEqual(SESSION_REQUIRED);
  });

  it('rejects an empty materials or channelIds list', async () => {
    const fixtures = await seedBaseFixtures();

    const emptyMaterials = await post({ ...baseBody(fixtures), materials: [] }, adminCookie);
    expect(emptyMaterials.status).toBe(400);

    const emptyChannels = await post({ ...baseBody(fixtures), channelIds: [] }, adminCookie);
    expect(emptyChannels.status).toBe(400);
  });
});
