import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createMaterial } from './materials-helper.js';
import { createPrinter } from './printers-helper.js';
import { createProduct, createVariant, deleteProducts } from './products-helper.js';
import { createStockItem } from './stock-items-helper.js';

const EMAILS = ['products-admin@test.local', 'products-production@test.local', 'products-sales@test.local'];

const INVALID_URL = 'URL do modelo inválida: use um link de modelo do Printables, do MakerWorld ou do Thingiverse';
const DUPLICATE_MODEL = 'Já existe um produto para este modelo';
const PRODUCT_NOT_FOUND = 'Produto não encontrado';
const VARIANT_NOT_FOUND = 'Variação não encontrada';
const DUPLICATE_VARIANT = 'Já existe uma variação com este nome neste produto';
const PERMISSION_DENIED = { error: 'Você não tem permissão para esta ação' };
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

interface VariantBody {
  name: string;
  printerId: string;
  printHours: number;
  prepHours: number;
  slicingHours: number;
  postProcessingHours: number;
  materials: Array<{ materialId: string; grams: number }>;
  supplies: Array<{ stockItemId: string; quantity: number }>;
}

describe('/products (e2e)', () => {
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
    await cleanup();
    await deleteUsers(dataSource, EMAILS);
    await createUser(dataSource, { email: EMAILS[0], role: 'admin' });
    await createUser(dataSource, { email: EMAILS[1], role: 'production' });
    await createUser(dataSource, { email: EMAILS[2], role: 'sales' });
    adminCookie = await loginCookie(app.getHttpServer(), EMAILS[0]);
    productionCookie = await loginCookie(app.getHttpServer(), EMAILS[1]);
    salesCookie = await loginCookie(app.getHttpServer(), EMAILS[2]);
  });

  async function cleanup(): Promise<void> {
    await deleteProducts(dataSource);
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM stock_items');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
    await dataSource.query('DELETE FROM printers');
  }

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await deleteUsers(dataSource, EMAILS);
    await app.close();
  });

  const server = () => app.getHttpServer();
  const postProduct = (body: object, cookie = adminCookie) =>
    request(server()).post('/products').set('Cookie', cookie).send(body);
  const patchProduct = (id: string, body: object, cookie = adminCookie) =>
    request(server()).patch(`/products/${id}`).set('Cookie', cookie).send(body);
  const getProduct = (id: string, cookie = adminCookie) =>
    request(server()).get(`/products/${id}`).set('Cookie', cookie);
  const postVariant = (productId: string, body: object, cookie = adminCookie) =>
    request(server()).post(`/products/${productId}/variants`).set('Cookie', cookie).send(body);
  const patchVariant = (productId: string, variantId: string, body: object, cookie = adminCookie) =>
    request(server()).patch(`/products/${productId}/variants/${variantId}`).set('Cookie', cookie).send(body);
  const errorOf = (response: { body: unknown }): string => (response.body as { error: string }).error;

  async function seedSheet() {
    const materialId = await createMaterial(dataSource, { type: 'PLA' });
    const secondMaterialId = await createMaterial(dataSource, { type: 'PETG', color: 'Azul' });
    const printerId = await createPrinter(dataSource, { name: 'Bambu P1S QA' });
    const stockItemId = await createStockItem(dataSource, { name: 'Argola de chaveiro' });
    return { materialId, secondMaterialId, printerId, stockItemId };
  }

  function variantBody(
    sheet: { materialId: string; printerId: string; stockItemId: string },
    overrides: Partial<VariantBody> = {},
  ): VariantBody {
    return {
      name: 'Laranja',
      printerId: sheet.printerId,
      printHours: 0.47,
      prepHours: 0.25,
      slicingHours: 0.1,
      postProcessingHours: 0,
      materials: [{ materialId: sheet.materialId, grams: 8 }],
      supplies: [{ stockItemId: sheet.stockItemId, quantity: 2 }],
      ...overrides,
    };
  }

  // ---------- S1: produto e URL do modelo ----------

  it('creates a product with the detected platform and no variants', async () => {
    const response = await postProduct({ name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Estrela do mar',
      active: true,
      variants: [],
      modelPlatform: 'makerworld',
      modelUrl: 'https://makerworld.com/models/3007827',
      commercialUseAllowed: null,
      modelMetadataFetchedAt: null,
    });
  });

  it('stores the canonical url for each platform', async () => {
    const cases = [
      {
        url: 'https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944',
        platform: 'makerworld',
        canonical: 'https://makerworld.com/models/3007827',
      },
      {
        url: 'https://www.printables.com/model/123456-some-slug?lang=en',
        platform: 'printables',
        canonical: 'https://www.printables.com/model/123456',
      },
      {
        url: 'https://www.thingiverse.com/thing:4567890/files',
        platform: 'thingiverse',
        canonical: 'https://www.thingiverse.com/thing:4567890',
      },
    ];
    for (const item of cases) {
      const response = await postProduct({ name: `Produto ${item.platform}`, modelUrl: item.url });
      expect(response.status, item.url).toBe(201);
      expect(response.body.modelPlatform, item.url).toBe(item.platform);
      expect(response.body.modelUrl, item.url).toBe(item.canonical);
    }
  });

  it('rejects a model url outside the three platforms', async () => {
    const withMessage = [
      'https://example.com/model/1',
      'http://www.printables.com/model/1',
      'https://www.thingiverse.com/about',
    ];
    for (const modelUrl of withMessage) {
      const response = await postProduct({ name: 'Produto inválido', modelUrl });
      expect(response.status, modelUrl).toBe(400);
      expect(response.body, modelUrl).toEqual({ error: INVALID_URL });
    }
    const missing = await postProduct({ name: 'Produto sem URL' });
    expect(missing.status).toBe(400);
    const count: Array<{ n: string }> = await dataSource.query('SELECT count(*) AS n FROM products');
    expect(count[0].n).toBe('0');
  });

  it('rejects a second product for the same model with 409', async () => {
    const first = await postProduct({ name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' });
    expect(first.status).toBe(201);
    const second = await postProduct({
      name: 'Outra estrela',
      modelUrl: 'https://makerworld.com/pt/models/3007827-outro-slug',
    });
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: DUPLICATE_MODEL });
  });

  it("rejects a patch that points to another product's model with 409", async () => {
    await postProduct({ name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' });
    const other = await postProduct({ name: 'Vaso espiral', modelUrl: 'https://www.printables.com/model/123456' });
    const response = await patchProduct(other.body.id as string, { modelUrl: 'https://makerworld.com/models/3007827' });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: DUPLICATE_MODEL });
  });

  it('validates product field bounds on both sides', async () => {
    const rejected: Array<{ label: string; body: object }> = [
      { label: 'name vazio', body: { name: '', modelUrl: 'https://makerworld.com/models/1' } },
      { label: 'name 151', body: { name: 'a'.repeat(151), modelUrl: 'https://makerworld.com/models/2' } },
      {
        label: 'description 2001',
        body: { name: 'Produto', description: 'd'.repeat(2001), modelUrl: 'https://makerworld.com/models/3' },
      },
      {
        label: 'modelImageUrl http',
        body: { name: 'Produto', modelImageUrl: 'http://img.example/a.png', modelUrl: 'https://makerworld.com/models/4' },
      },
      { label: 'cost extra', body: { name: 'Produto', cost: 100, modelUrl: 'https://makerworld.com/models/5' } },
    ];
    for (const item of rejected) {
      const response = await postProduct(item.body);
      expect(response.status, item.label).toBe(400);
      expect(typeof errorOf(response), item.label).toBe('string');
    }
    const name150 = await postProduct({ name: 'a'.repeat(150), modelUrl: 'https://makerworld.com/models/6' });
    expect(name150.status).toBe(201);
    const description2000 = await postProduct({
      name: 'Produto',
      description: 'd'.repeat(2000),
      modelUrl: 'https://makerworld.com/models/7',
    });
    expect(description2000.status).toBe(201);
  });

  it('deactivates and reactivates a product without deleting it', async () => {
    const sheet = await seedSheet();
    const created = await postProduct({ name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' });
    const id = created.body.id as string;
    await postVariant(id, variantBody(sheet));

    const deactivated = await patchProduct(id, { active: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.active).toBe(false);

    const detail = await getProduct(id);
    expect(detail.status).toBe(200);
    expect(detail.body.active).toBe(false);
    expect((detail.body.variants as unknown[]).length).toBe(1);

    const reactivated = await patchProduct(id, { active: true });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.active).toBe(true);
  });

  it('returns 400 for a malformed id and 404 for an unknown product', async () => {
    expect((await getProduct('not-a-uuid')).status).toBe(400);
    expect((await patchProduct('not-a-uuid', { name: 'x' })).status).toBe(400);
    const getUnknown = await getProduct(UNKNOWN_ID);
    expect(getUnknown.status).toBe(404);
    expect(getUnknown.body).toEqual({ error: PRODUCT_NOT_FOUND });
    const patchUnknown = await patchProduct(UNKNOWN_ID, { name: 'x' });
    expect(patchUnknown.status).toBe(404);
    expect(patchUnknown.body).toEqual({ error: PRODUCT_NOT_FOUND });
  });

  it('searches name and model title case-insensitively with the AD-020 envelope', async () => {
    await createProduct(dataSource, { name: 'Estrela do mar', modelExternalId: '3007827', modelTitle: 'Sea animals set' });
    await createProduct(dataSource, { name: 'Vaso espiral', modelExternalId: '42', modelTitle: null });

    const byTitle = await request(server()).get('/products?search=SEA').set('Cookie', adminCookie);
    expect(byTitle.status).toBe(200);
    expect((byTitle.body.items as Array<{ name: string }>).map((item) => item.name)).toEqual(['Estrela do mar']);
    expect(byTitle.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });

    const byName = await request(server()).get('/products?search=espiral').set('Cookie', adminCookie);
    expect(byName.status).toBe(200);
    expect((byName.body.items as Array<{ name: string }>).map((item) => item.name)).toEqual(['Vaso espiral']);
    expect(byName.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
  });

  it('filters by platform and bounds pageSize', async () => {
    await createProduct(dataSource, { name: 'Estrela do mar', modelExternalId: '3007827' });
    await createProduct(dataSource, {
      name: 'Vaso espiral',
      modelPlatform: 'printables',
      modelExternalId: '123456',
      modelUrl: 'https://www.printables.com/model/123456',
    });

    const printables = await request(server()).get('/products?platform=printables').set('Cookie', adminCookie);
    expect(printables.status).toBe(200);
    expect((printables.body.items as Array<{ name: string }>).map((item) => item.name)).toEqual(['Vaso espiral']);

    expect((await request(server()).get('/products?pageSize=101').set('Cookie', adminCookie)).status).toBe(400);
    expect((await request(server()).get('/products?pageSize=100').set('Cookie', adminCookie)).status).toBe(200);
  });

  // ---------- S2: variações e ficha técnica ----------

  it('creates a variant with its tech sheet and resolved names', async () => {
    const sheet = await seedSheet();
    const productId = await createProduct(dataSource, { name: 'Estrela do mar', modelExternalId: '3007827' });
    const response = await postVariant(productId, variantBody(sheet));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      productId,
      name: 'Laranja',
      active: true,
      printer: { id: sheet.printerId, name: 'Bambu P1S QA' },
      printHours: 0.47,
      prepHours: 0.25,
      slicingHours: 0.1,
      postProcessingHours: 0,
      materials: [{ materialId: sheet.materialId, name: 'PLA · Marca de teste · Natural', grams: 8 }],
      supplies: [{ stockItemId: sheet.stockItemId, name: 'Argola de chaveiro', quantity: 2 }],
    });
  });

  it('validates variant bounds on both sides', async () => {
    const sheet = await seedSheet();
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });
    const material = { materialId: sheet.materialId, grams: 8 };
    const supply = { stockItemId: sheet.stockItemId, quantity: 1 };
    const rejected: Array<{ label: string; body: object }> = [
      { label: 'printHours -1', body: variantBody(sheet, { printHours: -1 }) },
      { label: 'prepHours -0.01', body: variantBody(sheet, { prepHours: -0.01 }) },
      { label: 'grams 0', body: variantBody(sheet, { materials: [{ materialId: sheet.materialId, grams: 0 }] }) },
      { label: 'quantity 0', body: variantBody(sheet, { supplies: [{ stockItemId: sheet.stockItemId, quantity: 0 }] }) },
      { label: 'materials []', body: variantBody(sheet, { materials: [] }) },
      { label: '33 materials', body: variantBody(sheet, { materials: Array.from({ length: 33 }, () => material) }) },
      { label: '51 supplies', body: variantBody(sheet, { supplies: Array.from({ length: 51 }, () => supply) }) },
      { label: 'name vazio', body: variantBody(sheet, { name: '' }) },
    ];
    for (const item of rejected) {
      const response = await postVariant(productId, item.body);
      expect(response.status, item.label).toBe(400);
      expect(typeof errorOf(response), item.label).toBe('string');
    }
    const accepted: Array<{ label: string; body: object }> = [
      { label: 'printHours 0', body: variantBody(sheet, { name: 'Zero', printHours: 0 }) },
      {
        label: '32 materials',
        body: variantBody(sheet, { name: 'Trinta e dois', materials: Array.from({ length: 32 }, () => material) }),
      },
      {
        label: '50 supplies',
        body: variantBody(sheet, { name: 'Cinquenta', supplies: Array.from({ length: 50 }, () => supply) }),
      },
    ];
    for (const item of accepted) {
      const response = await postVariant(productId, item.body);
      expect(response.status, item.label).toBe(201);
    }
  });

  it('returns 404 naming the unknown product, printer, material or stock item', async () => {
    const sheet = await seedSheet();
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });

    const product = await postVariant(UNKNOWN_ID, variantBody(sheet));
    expect(product.status).toBe(404);
    expect(product.body).toEqual({ error: 'Produto não encontrado' });

    const printer = await postVariant(productId, variantBody(sheet, { printerId: UNKNOWN_ID }));
    expect(printer.status).toBe(404);
    expect(printer.body).toEqual({ error: `Impressora ${UNKNOWN_ID} não encontrada` });

    const material = await postVariant(productId, variantBody(sheet, { materials: [{ materialId: UNKNOWN_ID, grams: 8 }] }));
    expect(material.status).toBe(404);
    expect(material.body).toEqual({ error: `Material ${UNKNOWN_ID} não encontrado` });

    const stockItem = await postVariant(
      productId,
      variantBody(sheet, { supplies: [{ stockItemId: UNKNOWN_ID, quantity: 1 }] }),
    );
    expect(stockItem.status).toBe(404);
    expect(stockItem.body).toEqual({ error: `Insumo ${UNKNOWN_ID} não encontrado` });
  });

  it('enforces case-insensitive variant name uniqueness within a product only', async () => {
    const sheet = await seedSheet();
    const productA = await createProduct(dataSource, { name: 'Produto A', modelExternalId: '1001' });
    const productB = await createProduct(dataSource, { name: 'Produto B', modelExternalId: '1002' });
    expect((await postVariant(productA, variantBody(sheet, { name: 'Laranja' }))).status).toBe(201);

    const duplicate = await postVariant(productA, variantBody(sheet, { name: 'laranja' }));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: DUPLICATE_VARIANT });

    expect((await postVariant(productB, variantBody(sheet, { name: 'Laranja' }))).status).toBe(201);

    const other = await postVariant(productA, variantBody(sheet, { name: 'Azul' }));
    const rename = await patchVariant(productA, other.body.id as string, { name: 'LARANJA' });
    expect(rename.status).toBe(409);
    expect(rename.body).toEqual({ error: DUPLICATE_VARIANT });
  });

  it('replaces only the lists sent in a variant patch', async () => {
    const sheet = await seedSheet();
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });
    const created = await postVariant(
      productId,
      variantBody(sheet, {
        materials: [
          { materialId: sheet.materialId, grams: 8 },
          { materialId: sheet.secondMaterialId, grams: 1 },
        ],
        supplies: [{ stockItemId: sheet.stockItemId, quantity: 2 }],
      }),
    );
    const variantId = created.body.id as string;

    const newMaterials = await patchVariant(productId, variantId, {
      materials: [{ materialId: sheet.secondMaterialId, grams: 12 }],
    });
    expect(newMaterials.status).toBe(200);
    expect(newMaterials.body.materials).toEqual([
      { materialId: sheet.secondMaterialId, name: 'PETG · Marca de teste · Azul', grams: 12 },
    ]);
    expect(newMaterials.body.supplies).toEqual([
      { stockItemId: sheet.stockItemId, name: 'Argola de chaveiro', quantity: 2 },
    ]);

    const noSupplies = await patchVariant(productId, variantId, { supplies: [] });
    expect(noSupplies.status).toBe(200);
    expect(noSupplies.body.supplies).toEqual([]);
    expect(noSupplies.body.materials).toEqual([
      { materialId: sheet.secondMaterialId, name: 'PETG · Marca de teste · Azul', grams: 12 },
    ]);

    const renamed = await patchVariant(productId, variantId, { name: 'Laranja neon' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Laranja neon');
    expect(renamed.body.materials).toEqual([
      { materialId: sheet.secondMaterialId, name: 'PETG · Marca de teste · Azul', grams: 12 },
    ]);
    expect(renamed.body.supplies).toEqual([]);
  });

  it('two concurrent creates of the same model yield one 201 and one 409', async () => {
    const body = { name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' };
    const responses = await Promise.all([postProduct(body), postProduct(body)]);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const rows: Array<{ n: string }> = await dataSource.query(
      `SELECT count(*) AS n FROM products WHERE model_platform = 'makerworld' AND model_external_id = '3007827'`,
    );
    expect(rows[0].n).toBe('1');
  });

  it('returns 404 for a variant outside the product', async () => {
    const sheet = await seedSheet();
    const productA = await createProduct(dataSource, { name: 'Produto A', modelExternalId: '1001' });
    const productB = await createProduct(dataSource, { name: 'Produto B', modelExternalId: '1002' });
    const variantOfB = await createVariant(dataSource, {
      productId: productB,
      printerId: sheet.printerId,
      materials: [{ materialId: sheet.materialId, grams: 8 }],
    });

    const foreign = await patchVariant(productA, variantOfB, { name: 'Invasora' });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: VARIANT_NOT_FOUND });

    const unknown = await patchVariant(productA, UNKNOWN_ID, { name: 'Fantasma' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: VARIANT_NOT_FOUND });
  });

  it('deactivates a variant without deleting it', async () => {
    const sheet = await seedSheet();
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });
    const created = await postVariant(productId, variantBody(sheet));
    const variantId = created.body.id as string;

    const deactivated = await patchVariant(productId, variantId, { active: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.active).toBe(false);

    const detail = await getProduct(productId);
    expect(detail.body.variants).toEqual([expect.objectContaining({ id: variantId, active: false })]);
  });

  // ---------- S5: papéis ----------

  it('production and sales read the catalog and its pricing', async () => {
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });
    const routes = ['/products', `/products/${productId}`, `/products/${productId}/pricing`];
    for (const cookie of [productionCookie, salesCookie]) {
      for (const route of routes) {
        const response = await request(server()).get(route).set('Cookie', cookie);
        expect(response.status, route).toBe(200);
      }
    }
  });

  it('only admin writes to the catalog', async () => {
    const sheet = await seedSheet();
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });
    const variantId = await createVariant(dataSource, {
      productId,
      printerId: sheet.printerId,
      name: 'Existente',
      materials: [{ materialId: sheet.materialId, grams: 8 }],
    });

    for (const cookie of [productionCookie, salesCookie]) {
      const writes = [
        await postProduct({ name: 'Negado', modelUrl: 'https://makerworld.com/models/9' }, cookie),
        await patchProduct(productId, { name: 'Negado' }, cookie),
        await postVariant(productId, variantBody(sheet, { name: 'Negada' }), cookie),
        await patchVariant(productId, variantId, { name: 'Negada' }, cookie),
      ];
      for (const response of writes) {
        expect(response.status).toBe(403);
        expect(response.body).toEqual(PERMISSION_DENIED);
      }
    }

    expect((await postProduct({ name: 'Liberado', modelUrl: 'https://makerworld.com/models/9' })).status).toBe(201);
    expect((await patchProduct(productId, { name: 'Liberado' })).status).toBe(200);
    expect((await postVariant(productId, variantBody(sheet, { name: 'Liberada' }))).status).toBe(201);
    expect((await patchVariant(productId, variantId, { name: 'Liberada 2' })).status).toBe(200);
  });

  it('every products route is 401 without a session', async () => {
    const productId = await createProduct(dataSource, { modelExternalId: '3007827' });
    const responses = [
      await request(server()).get('/products'),
      await request(server()).post('/products').send({ name: 'x', modelUrl: 'https://makerworld.com/models/9' }),
      await request(server()).get(`/products/${productId}`),
      await request(server()).patch(`/products/${productId}`).send({ name: 'x' }),
      await request(server()).post(`/products/${productId}/variants`).send({}),
      await request(server()).patch(`/products/${productId}/variants/${UNKNOWN_ID}`).send({}),
      await request(server()).get(`/products/${productId}/pricing`),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });
});
