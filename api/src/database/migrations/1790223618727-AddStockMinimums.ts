import { MigrationInterface, QueryRunner } from "typeorm";

// Segunda migration do sistema que altera tabelas com linhas: `materials` e `stock_items` já têm
// cadastro. As duas colunas entram NULL e sem DEFAULT (door 1), então nenhuma linha atual passa a
// gerar alerta e não há backfill; o CHECK de não negatividade é satisfeito por toda linha atual
// justamente porque todas ficam nulas.
//
// O `migration:generate` também propôs recriar os enums de `users_role`, `stock_items_category` e
// `inventory_movements_type` (churn de ordenação, sem mudança de valor) e derrubar a FK
// `FK_fixed_cost_items_settings_id`. Nada disso pertence a esta fase e a FK é dado de produção,
// então ficaram fora.
export class AddStockMinimums1790223618727 implements MigrationInterface {
    name = 'AddStockMinimums1790223618727'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "materials" ADD "minimum_stock_grams" double precision`);
        await queryRunner.query(`ALTER TABLE "stock_items" ADD "minimum_quantity" double precision`);
        await queryRunner.query(`ALTER TABLE "materials" ADD CONSTRAINT "materials_minimum_non_negative" CHECK ("minimum_stock_grams" IS NULL OR "minimum_stock_grams" >= 0)`);
        await queryRunner.query(`ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_minimum_non_negative" CHECK ("minimum_quantity" IS NULL OR "minimum_quantity" >= 0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_items" DROP CONSTRAINT "stock_items_minimum_non_negative"`);
        await queryRunner.query(`ALTER TABLE "materials" DROP CONSTRAINT "materials_minimum_non_negative"`);
        await queryRunner.query(`ALTER TABLE "stock_items" DROP COLUMN "minimum_quantity"`);
        await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN "minimum_stock_grams"`);
    }

}
