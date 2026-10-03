import { DataSource, type QueryRunner } from 'typeorm';
import { RemoveDryingFields1791054875395 } from '../src/database/migrations/1791054875395-RemoveDryingFields.js';
import { buildTypeOrmOptions } from '../src/database/typeorm-options.js';
import { createRoll } from './inventory-helper.js';
import { createMaterial } from './materials-helper.js';

// Migration que altera tabelas com linhas (`materials` e `filament_rolls` já têm cadastro): o
// `down()` recria `needs_drying` NOT NULL sobre linhas existentes, o que só passa com o DEFAULT
// temporário, e o `up()` derruba as colunas sem perder as linhas.
describe('RemoveDryingFields migration (e2e)', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  async function cleanup(): Promise<void> {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
  }

  async function columnsOf(table: string, names: string[]): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND column_name = ANY($2)
       ORDER BY column_name`,
      [table, names],
    );
    return rows.map((row) => row.column_name);
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

  it('reverting and re-applying the drying removal preserves existing rows and drops the columns', async () => {
    const materialId = await createMaterial(dataSource, { type: 'PETG-drying', brand: 'Voolt', color: 'Azul' });
    const rollId = await createRoll(dataSource, { materialId, balanceGrams: 640 });

    const migration = new RemoveDryingFields1791054875395();
    const dryingColumns = ['drying_hours', 'drying_temperature_c', 'needs_drying'];

    // Volta ao schema anterior: as colunas reaparecem sobre as linhas existentes, com o material
    // "sem secagem" e o rolo "nunca secado".
    await migration.down(queryRunner);
    expect(await columnsOf('materials', dryingColumns)).toEqual(['drying_hours', 'drying_temperature_c', 'needs_drying']);
    expect(await columnsOf('filament_rolls', ['last_dried_at'])).toEqual(['last_dried_at']);
    const materialsAfterDown: Array<{
      id: string;
      type: string;
      needs_drying: boolean;
      drying_temperature_c: number | null;
      drying_hours: number | null;
    }> = await dataSource.query(
      'SELECT id, type, needs_drying, drying_temperature_c, drying_hours FROM materials',
    );
    expect(materialsAfterDown).toEqual([
      { id: materialId, type: 'PETG-drying', needs_drying: false, drying_temperature_c: null, drying_hours: null },
    ]);
    const rollsAfterDown: Array<{ id: string; balance_grams: number; last_dried_at: Date | null }> =
      await dataSource.query('SELECT id, balance_grams, last_dried_at FROM filament_rolls');
    expect(rollsAfterDown).toEqual([{ id: rollId, balance_grams: 640, last_dried_at: null }]);

    // O DEFAULT do `down()` é só para preencher as linhas: a coluna recriada fica sem DEFAULT,
    // como na CreateMaterials.
    const [needsDrying]: Array<{ column_default: string | null }> = await dataSource.query(
      `SELECT column_default FROM information_schema.columns
       WHERE table_name = 'materials' AND column_name = 'needs_drying'`,
    );
    expect(needsDrying.column_default).toBeNull();

    // Reaplica: as colunas somem e as linhas ficam.
    await migration.up(queryRunner);
    expect(await columnsOf('materials', dryingColumns)).toEqual([]);
    expect(await columnsOf('filament_rolls', ['last_dried_at'])).toEqual([]);
    const materialsAfterUp: Array<{ id: string; type: string; brand: string; color: string }> =
      await dataSource.query('SELECT id, type, brand, color FROM materials');
    expect(materialsAfterUp).toEqual([{ id: materialId, type: 'PETG-drying', brand: 'Voolt', color: 'Azul' }]);
    const rollsAfterUp: Array<{ id: string; material_id: string; balance_grams: number }> =
      await dataSource.query('SELECT id, material_id, balance_grams FROM filament_rolls');
    expect(rollsAfterUp).toEqual([{ id: rollId, material_id: materialId, balance_grams: 640 }]);
  });
});
