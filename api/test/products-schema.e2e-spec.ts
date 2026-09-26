import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createMaterial } from './materials-helper.js';
import { createPrinter } from './printers-helper.js';
import { createProduct, createVariant, deleteProducts } from './products-helper.js';
import { createStockItem } from './stock-items-helper.js';

// Invariantes do banco (door 3, door 4, door 5), um teste por lado, direto por SQL.
describe('products schema (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await cleanup();
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
    await app.close();
  });

  async function codeOf(promise: Promise<unknown>): Promise<string | null> {
    try {
      await promise;
      return null;
    } catch (error) {
      return (error as { driverError?: { code?: string } }).driverError?.code ?? 'unknown';
    }
  }

  const insertProduct = (platform: string, externalId: string) =>
    dataSource.query(
      `INSERT INTO products (name, model_url, model_platform, model_external_id) VALUES ('P', 'https://x', $1, $2)`,
      [platform, externalId],
    );

  it('unique model index rejects the same platform and id only', async () => {
    await insertProduct('makerworld', '3007827');
    expect(await codeOf(insertProduct('makerworld', '3007827'))).toBe('23505');
    expect(await codeOf(insertProduct('printables', '3007827'))).toBeNull();
  });

  it('unique variant name index is case-insensitive and per product', async () => {
    const printerId = await createPrinter(dataSource, { name: 'Impressora schema' });
    const productA = await createProduct(dataSource, { modelExternalId: '1' });
    const productB = await createProduct(dataSource, { modelExternalId: '2' });
    await createVariant(dataSource, { productId: productA, printerId, name: 'Azul' });
    expect(await codeOf(createVariant(dataSource, { productId: productA, printerId, name: 'AZUL' }))).toBe('23505');
    expect(await codeOf(createVariant(dataSource, { productId: productB, printerId, name: 'Azul' }))).toBeNull();
  });

  it('tech sheet foreign keys restrict deleting referenced registries', async () => {
    const printerId = await createPrinter(dataSource, { name: 'Impressora schema' });
    const materialId = await createMaterial(dataSource, { type: 'PLA' });
    const unreferencedMaterialId = await createMaterial(dataSource, { type: 'ABS' });
    const stockItemId = await createStockItem(dataSource, { name: 'Ímã 6x2' });
    const productId = await createProduct(dataSource, { modelExternalId: '1' });
    await createVariant(dataSource, {
      productId,
      printerId,
      materials: [{ materialId, grams: 10 }],
      supplies: [{ stockItemId, quantity: 1 }],
    });

    const cases = [
      { table: 'materials', id: materialId },
      { table: 'stock_items', id: stockItemId },
      { table: 'printers', id: printerId },
    ];
    for (const item of cases) {
      expect(await codeOf(dataSource.query(`DELETE FROM ${item.table} WHERE id = $1`, [item.id])), item.table).toBe(
        '23503',
      );
    }
    expect(await codeOf(dataSource.query('DELETE FROM materials WHERE id = $1', [unreferencedMaterialId]))).toBeNull();
  });

  it('commercial use defaults to null and platform is a closed enum', async () => {
    await insertProduct('thingiverse', '4567890');
    const rows: Array<{ commercial_use_allowed: boolean | null }> = await dataSource.query(
      `SELECT commercial_use_allowed FROM products WHERE model_external_id = '4567890'`,
    );
    expect(rows[0].commercial_use_allowed).toBeNull();
    expect(await codeOf(insertProduct('cults3d', '1'))).toBe('22P02');
  });
});
