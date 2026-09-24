import { DataSource, type QueryRunner } from 'typeorm';
import { AddStockMinimums1790223618727 } from '../src/database/migrations/1790223618727-AddStockMinimums.js';
import { buildTypeOrmOptions } from '../src/database/typeorm-options.js';
import { createMaterial } from './materials-helper.js';
import { createStockItem } from './stock-items-helper.js';

// Segunda migration do sistema que altera tabelas com linhas (`materials` e `stock_items` já têm
// cadastro). Sem este arquivo ela só teria sido exercitada uma vez contra um banco vazio, que é o
// único cenário em que ela não pode falhar.
describe('AddStockMinimums migration (e2e)', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function cleanup(): Promise<void> {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM stock_item_printers');
    await dataSource.query('DELETE FROM stock_items');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
  }

  beforeAll(async () => {
    dataSource = new DataSource(buildTypeOrmOptions((key) => process.env[key]));
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
  });

  afterAll(async () => {
    await queryRunner.release();
    await cleanup();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanup();
  });

  it('reverting and re-applying the minimums migration preserves existing rows and leaves the columns null', async () => {
    // Semeado ANTES, com piso preenchido nas duas tabelas: é o estado que a migration encontra
    // num banco que já roda.
    const materialId = await createMaterial(dataSource, {
      type: 'PLA-minimums',
      brand: 'Voolt',
      color: 'Preto',
      minimumStockGrams: 500,
    });
    const itemId = await createStockItem(dataSource, { name: 'Ímã de migration', minimumQuantity: 10 });

    const migration = new AddStockMinimums1790223618727();

    // Volta ao schema da Fase 10: as colunas somem, as linhas ficam.
    await migration.down(queryRunner);
    const materialsAfterDown: Array<{ id: string; type: string }> = await dataSource.query(
      'SELECT id, type FROM materials',
    );
    expect(materialsAfterDown).toHaveLength(1);
    expect(materialsAfterDown[0].id).toBe(materialId);
    expect(materialsAfterDown[0].type).toBe('PLA-minimums');
    const itemsAfterDown: Array<{ id: string; name: string }> = await dataSource.query(
      'SELECT id, name FROM stock_items',
    );
    expect(itemsAfterDown).toHaveLength(1);
    expect(itemsAfterDown[0].id).toBe(itemId);
    expect(itemsAfterDown[0].name).toBe('Ímã de migration');

    // Reaplica: as duas linhas continuam lá e as colunas voltam NULAS - nenhum backfill e
    // nenhum DEFAULT, então nenhum cadastro atual passa a gerar alerta (door 1).
    await migration.up(queryRunner);
    const materialsAfterUp: Array<{ id: string; type: string; minimum_stock_grams: number | null }> =
      await dataSource.query('SELECT id, type, minimum_stock_grams FROM materials');
    expect(materialsAfterUp).toHaveLength(1);
    expect(materialsAfterUp[0].id).toBe(materialId);
    expect(materialsAfterUp[0].type).toBe('PLA-minimums');
    expect(materialsAfterUp[0].minimum_stock_grams).toBeNull();
    const itemsAfterUp: Array<{ id: string; name: string; minimum_quantity: number | null }> =
      await dataSource.query('SELECT id, name, minimum_quantity FROM stock_items');
    expect(itemsAfterUp).toHaveLength(1);
    expect(itemsAfterUp[0].id).toBe(itemId);
    expect(itemsAfterUp[0].name).toBe('Ímã de migration');
    expect(itemsAfterUp[0].minimum_quantity).toBeNull();

    // E os dois CHECK reaplicados estão de fato valendo sobre tabelas que já tinham linha.
    const constraints: Array<{ conname: string }> = await dataSource.query(
      `SELECT conname FROM pg_constraint
       WHERE conname IN ('materials_minimum_non_negative', 'stock_items_minimum_non_negative')
       ORDER BY conname`,
    );
    expect(constraints.map((row) => row.conname)).toEqual([
      'materials_minimum_non_negative',
      'stock_items_minimum_non_negative',
    ]);
  });

  it('the database rejects a negative minimum on both tables', async () => {
    const materialId = await createMaterial(dataSource, { type: 'PLA-check' });
    const itemId = await createStockItem(dataSource, { name: 'Item de check' });

    const cases: Array<{ sql: string; id: string }> = [
      { sql: 'UPDATE materials SET minimum_stock_grams = -1 WHERE id = $1', id: materialId },
      { sql: 'UPDATE stock_items SET minimum_quantity = -1 WHERE id = $1', id: itemId },
    ];

    for (const violation of cases) {
      // 23514 = check_violation. O `400` da API é a primeira barreira; o CHECK é o backstop
      // (AD-023), e só um UPDATE direto no banco o exercita.
      await expect(dataSource.query(violation.sql, [violation.id])).rejects.toMatchObject({
        code: '23514',
      });
    }

    // Nenhum dos dois pisos ficou gravado.
    const materials: Array<{ minimum_stock_grams: number | null }> = await dataSource.query(
      'SELECT minimum_stock_grams FROM materials WHERE id = $1',
      [materialId],
    );
    expect(materials[0].minimum_stock_grams).toBeNull();
    const items: Array<{ minimum_quantity: number | null }> = await dataSource.query(
      'SELECT minimum_quantity FROM stock_items WHERE id = $1',
      [itemId],
    );
    expect(items[0].minimum_quantity).toBeNull();
  });
});
