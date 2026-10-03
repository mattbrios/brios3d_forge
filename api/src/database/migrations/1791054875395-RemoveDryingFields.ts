import { MigrationInterface, QueryRunner } from "typeorm";

// Remove a secagem do sistema (decisão do usuário, 2026-10-03): a receita de secagem do material
// (`needs_drying`, `drying_temperature_c`, `drying_hours`) e o registro de secagem do rolo
// (`last_dried_at`). Nenhuma regra lia essas colunas, e os valores gravados se perdem no `up()`.
//
// O `down()` recria as colunas sobre tabelas com linhas: `needs_drying` volta NOT NULL, então entra
// com DEFAULT false para preencher as linhas atuais e o DEFAULT sai em seguida (a coluna original
// não tinha DEFAULT). A secagem não é restaurada: todo material volta "sem secagem" e todo rolo
// "nunca secado".
//
// O `migration:generate` também propôs recriar os enums de `users_role`, `stock_items_category` e
// `inventory_movements_type` (churn de ordenação, sem mudança de valor) e derrubar a FK
// `FK_fixed_cost_items_settings_id`, o mesmo ruído já registrado em AddStockMinimums. Ficaram fora.
export class RemoveDryingFields1791054875395 implements MigrationInterface {
    name = 'RemoveDryingFields1791054875395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN "needs_drying"`);
        await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN "drying_temperature_c"`);
        await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN "drying_hours"`);
        await queryRunner.query(`ALTER TABLE "filament_rolls" DROP COLUMN "last_dried_at"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "filament_rolls" ADD "last_dried_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "materials" ADD "drying_hours" double precision`);
        await queryRunner.query(`ALTER TABLE "materials" ADD "drying_temperature_c" double precision`);
        await queryRunner.query(`ALTER TABLE "materials" ADD "needs_drying" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "needs_drying" DROP DEFAULT`);
    }

}
