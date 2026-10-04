import { DataSource, type QueryRunner } from 'typeorm';
import { AddMaterialColorHex1791140000000 } from '../src/database/migrations/1791140000000-AddMaterialColorHex.js';
import { buildTypeOrmOptions } from '../src/database/typeorm-options.js';
import { createMaterial } from './materials-helper.js';

// Migration que altera uma tabela com linhas (`materials` já tem cadastro): o `down()` derruba
// `color_hex` sem perder os materiais, e o `up()` a recria nula, com toda linha "sem tom".
describe('AddMaterialColorHex migration (e2e)', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddMaterialColorHex1791140000000();

  const SEEDED_COLUMNS =
    'id, type, brand, color, density_g_cm3, nozzle_temp_c, bed_temp_c, active, minimum_stock_grams';

  async function cleanup(): Promise<void> {
    await dataSource.query('DELETE FROM inventory_movements');
    await dataSource.query('DELETE FROM filament_rolls');
    await dataSource.query('DELETE FROM materials');
  }

  async function colorHexColumn(): Promise<
    Array<{ is_nullable: string; character_maximum_length: number | null; column_default: string | null }>
  > {
    return dataSource.query(
      `SELECT is_nullable, character_maximum_length, column_default FROM information_schema.columns
       WHERE table_name = 'materials' AND column_name = 'color_hex'`,
    );
  }

  let toned: string;
  let plain: string;

  beforeAll(async () => {
    dataSource = new DataSource(buildTypeOrmOptions((key) => process.env[key]));
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await cleanup();
    toned = await createMaterial(dataSource, {
      type: 'PLA-hex',
      brand: 'Voolt',
      color: 'Laranja',
      densityGCm3: 1.24,
      nozzleTempC: 220,
      bedTempC: 65,
      active: true,
      minimumStockGrams: 100,
      colorHex: '#ff8800',
    });
    plain = await createMaterial(dataSource, {
      type: 'PETG-hex',
      brand: 'Anycubic',
      color: 'Preto',
      densityGCm3: 1.27,
      nozzleTempC: 240,
      bedTempC: 80,
      active: false,
      minimumStockGrams: null,
    });
  });

  afterAll(async () => {
    // Garante o schema migrado para os próximos arquivos mesmo se um teste falhar no meio.
    if ((await colorHexColumn()).length === 0) await migration.up(queryRunner);
    await queryRunner.release();
    await cleanup();
    await dataSource.destroy();
  });

  const expectedRows = () => [
    {
      id: plain,
      type: 'PETG-hex',
      brand: 'Anycubic',
      color: 'Preto',
      density_g_cm3: 1.27,
      nozzle_temp_c: 240,
      bed_temp_c: 80,
      active: false,
      minimum_stock_grams: null,
    },
    {
      id: toned,
      type: 'PLA-hex',
      brand: 'Voolt',
      color: 'Laranja',
      density_g_cm3: 1.24,
      nozzle_temp_c: 220,
      bed_temp_c: 65,
      active: true,
      minimum_stock_grams: 100,
    },
  ];

  it('down keeps the seeded rows and drops color_hex', async () => {
    await migration.down(queryRunner);

    expect(await colorHexColumn()).toEqual([]);
    expect(await dataSource.query(`SELECT ${SEEDED_COLUMNS} FROM materials ORDER BY type`)).toEqual(expectedRows());
  });

  it('up recreates color_hex as nullable with NULL on existing rows', async () => {
    await migration.up(queryRunner);

    expect(await colorHexColumn()).toEqual([{ is_nullable: 'YES', character_maximum_length: 7, column_default: null }]);
    expect(await dataSource.query('SELECT id, color_hex FROM materials ORDER BY type')).toEqual([
      { id: plain, color_hex: null },
      { id: toned, color_hex: null },
    ]);
    expect(await dataSource.query(`SELECT ${SEEDED_COLUMNS} FROM materials ORDER BY type`)).toEqual(expectedRows());
  });
});
