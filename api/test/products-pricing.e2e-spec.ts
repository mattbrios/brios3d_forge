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
import { createPrinter } from './printers-helper.js';
import { createProduct, createVariant, deleteProducts } from './products-helper.js';
import { createSalesChannel, deleteSalesChannels, resetSettings } from './settings-helper.js';

const EMAIL = 'products-pricing-admin@test.local';
const CHANNELS = ['Balcão QA', 'Inativo QA'];
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

interface PricingEntry {
  variantId: string;
  name: string;
  pricing: {
    quantity: number;
    costs: { materialCents: number; laborCents: number };
    channels: Array<{ name: string }>;
  } | null;
  error: string | null;
}

describe('GET /products/:id/pricing (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let cookie: string;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await cleanup();
    await deleteUsers(dataSource, [EMAIL]);
    await createUser(dataSource, { email: EMAIL, role: 'admin' });
    cookie = await loginCookie(app.getHttpServer(), EMAIL);
    // purgeRate e failureRate em zero para o custo de material ser grams × custo médio.
    await resetSettings(dataSource, { laborCentsPerHour: 3000 });
  });

  async function cleanup(): Promise<void> {
    await deleteProducts(dataSource);
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
    await dataSource.query('DELETE FROM printers');
    await deleteSalesChannels(dataSource, CHANNELS);
  }

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await resetSettings(dataSource);
    await deleteUsers(dataSource, [EMAIL]);
    await app.close();
  });

  const getPricing = (productId: string) =>
    request(app.getHttpServer()).get(`/products/${productId}/pricing`).set('Cookie', cookie);

  // Caso de referência da Fase 12: dois rolos cheios de 1000 g a R$ 100,00 e R$ 120,00 dão
  // 11 centavos/g.
  async function seedLaranja() {
    const materialId = await createMaterial(dataSource, { type: 'PLA', color: 'Laranja' });
    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 10000 });
    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 12000 });
    const printerId = await createPrinter(dataSource, { name: 'Impressora preço QA' });
    await createSalesChannel(dataSource, { name: 'Balcão QA', active: true });
    await createSalesChannel(dataSource, { name: 'Inativo QA', active: false });
    const productId = await createProduct(dataSource, { name: 'Estrela do mar', modelExternalId: '3007827' });
    const variantId = await createVariant(dataSource, {
      productId,
      printerId,
      name: 'Laranja',
      printHours: 1,
      prepHours: 0.5,
      slicingHours: 0.25,
      postProcessingHours: 0.25,
      materials: [{ materialId, grams: 50 }],
    });
    return { materialId, printerId, productId, variantId };
  }

  it('prices each active variant with quantity 1, active channels and the settings labor rate', async () => {
    const { productId, variantId } = await seedLaranja();
    const response = await getPricing(productId);
    expect(response.status).toBe(200);
    const entries = response.body.variants as PricingEntry[];
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.variantId).toBe(variantId);
    expect(entry.name).toBe('Laranja');
    expect(entry.error).toBeNull();
    expect(entry.pricing?.quantity).toBe(1);
    expect(entry.pricing?.costs.materialCents).toBe(550);
    expect(entry.pricing?.costs.laborCents).toBe(3000);
    const channelNames = entry.pricing?.channels.map((channel) => channel.name) ?? [];
    expect(channelNames).toContain('Balcão QA');
    expect(channelNames).not.toContain('Inativo QA');
  });

  it("reflects a new roll's average cost without writing to the product", async () => {
    const { materialId, productId } = await seedLaranja();
    const before = await getPricing(productId);
    expect((before.body.variants as PricingEntry[])[0].pricing?.costs.materialCents).toBe(550);

    const snapshot = async () => ({
      product: (await dataSource.query('SELECT updated_at FROM products WHERE id = $1', [productId])) as unknown,
      lines: (await dataSource.query(
        'SELECT m.* FROM product_variant_materials m JOIN product_variants v ON v.id = m.variant_id WHERE v.product_id = $1',
        [productId],
      )) as unknown,
    });
    const stored = await snapshot();

    await createRoll(dataSource, { materialId, initialWeightGrams: 1000, balanceGrams: 1000, acquisitionCostCents: 30000 });

    const after = await getPricing(productId);
    expect(after.status).toBe(200);
    expect((after.body.variants as PricingEntry[])[0].pricing?.costs.materialCents).toBe(867);
    expect(await snapshot()).toEqual(stored);
  });

  it("isolates one variant's failure from the others", async () => {
    const { printerId, productId } = await seedLaranja();
    const blackId = await createMaterial(dataSource, { type: 'PLA', color: 'Preto' });
    await createRoll(dataSource, { materialId: blackId, discardedAt: new Date(), acquisitionCostCents: 10000 });
    await createVariant(dataSource, {
      productId,
      printerId,
      name: 'Preto',
      materials: [{ materialId: blackId, grams: 20 }],
    });

    const response = await getPricing(productId);
    expect(response.status).toBe(200);
    const entries = response.body.variants as PricingEntry[];
    const black = entries.find((entry) => entry.name === 'Preto');
    const orange = entries.find((entry) => entry.name === 'Laranja');
    expect(black?.pricing).toBeNull();
    expect(black?.error).toBe('Material sem custo médio disponível: PLA · Marca de teste · Preto');
    expect(orange?.error).toBeNull();
    expect(orange?.pricing?.costs.materialCents).toBe(550);
  });

  it('returns an empty list when no variant is active', async () => {
    const withoutVariants = await createProduct(dataSource, { name: 'Sem variação', modelExternalId: '1' });
    const empty = await getPricing(withoutVariants);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ variants: [] });

    const { productId } = await seedLaranja();
    await dataSource.query('UPDATE product_variants SET active = false WHERE product_id = $1', [productId]);
    const inactive = await getPricing(productId);
    expect(inactive.status).toBe(200);
    expect(inactive.body).toEqual({ variants: [] });
  });

  it('returns 400 for a malformed id and 404 for an unknown product', async () => {
    expect((await getPricing('not-a-uuid')).status).toBe(400);
    const unknown = await getPricing(UNKNOWN_ID);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Produto não encontrado' });
  });
});
