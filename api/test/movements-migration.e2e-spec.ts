import { DataSource, type QueryRunner } from 'typeorm';
import { AlterInventoryMovementsOwner1790189659473 } from '../src/database/migrations/1790189659473-AlterInventoryMovementsOwner.js';
import { buildTypeOrmOptions } from '../src/database/typeorm-options.js';
import { createUser, deleteUsers } from './auth-helper.js';
import { createRoll } from './inventory-helper.js';
import { createMaterial } from './materials-helper.js';

const EMAIL = 'migration-admin@test.local';

// Primeira migration do sistema que altera uma tabela com linhas: a única forma de exercitá-la é
// com dado semeado, rodando `down()` e `up()` de verdade. Sem isto ela só teria sido rodada uma
// vez contra um banco vazio - o único cenário em que ela não pode falhar.
describe('AlterInventoryMovementsOwner migration (e2e)', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let userId: string;
  let rollId: string;

  // A FK de `user_id` obriga a apagar os movimentos antes do usuário do teste.
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
    await cleanup();
    await deleteUsers(dataSource, [EMAIL]);
    userId = await createUser(dataSource, { email: EMAIL, role: 'admin' });
  });

  afterAll(async () => {
    await queryRunner.release();
    await cleanup();
    await deleteUsers(dataSource, [EMAIL]);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanup();
    const materialId = await createMaterial(dataSource, { type: `PLA-migration-${Date.now()}` });
    rollId = await createRoll(dataSource, { materialId });
  });

  it('reverting and re-applying the movements migration preserves existing rows', async () => {
    await dataSource.query(
      `INSERT INTO inventory_movements (roll_id, type, quantity, unit_cost_cents, user_id)
       VALUES ($1, 'entrada', 1000, 12, $2)`,
      [rollId, userId],
    );

    const migration = new AlterInventoryMovementsOwner1790189659473();

    // Volta ao schema da Fase 9: as colunas recuperam o nome antigo com o valor intacto.
    await migration.down(queryRunner);
    const beforeUp: Array<{ quantity_grams: string; unit_cost_cents_per_gram: string }> =
      await dataSource.query('SELECT quantity_grams, unit_cost_cents_per_gram FROM inventory_movements');
    expect(beforeUp).toHaveLength(1);
    expect(Number(beforeUp[0].quantity_grams)).toBe(1000);
    expect(Number(beforeUp[0].unit_cost_cents_per_gram)).toBe(12);

    // Reaplica: o RENAME preserva o valor, `stock_item_id` nasce nulo e o CHECK de dono único é
    // satisfeito pela linha que já existia - sem backfill.
    await migration.up(queryRunner);
    const afterUp: Array<{ quantity: string; unit_cost_cents: string; stock_item_id: string | null; roll_id: string }> =
      await dataSource.query('SELECT quantity, unit_cost_cents, stock_item_id, roll_id FROM inventory_movements');
    expect(afterUp).toHaveLength(1);
    expect(Number(afterUp[0].quantity)).toBe(1000);
    expect(Number(afterUp[0].unit_cost_cents)).toBe(12);
    expect(afterUp[0].stock_item_id).toBeNull();
    expect(afterUp[0].roll_id).toBe(rollId);

    // E o CHECK reaplicado está de fato valendo sobre a tabela que já tinha linha.
    const constraints: Array<{ conname: string }> = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'movement_single_owner'`,
    );
    expect(constraints).toHaveLength(1);
  });
});
