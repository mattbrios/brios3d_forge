import { MigrationInterface, QueryRunner } from "typeorm";

// Primeira migration do sistema que altera uma tabela com linhas: `inventory_movements` já tem
// histórico de rolo. As duas colunas são RENAMEadas (nunca DROP + ADD, que perderia o valor), e
// o CHECK de dono único é satisfeito por toda linha atual, porque toda ela tem `roll_id`
// preenchido e `stock_item_id` nulo - sem backfill.
export class AlterInventoryMovementsOwner1790189659473 implements MigrationInterface {
    name = 'AlterInventoryMovementsOwner1790189659473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_movements" ALTER COLUMN "roll_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD "stock_item_id" uuid`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" RENAME COLUMN "quantity_grams" TO "quantity"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" RENAME COLUMN "unit_cost_cents_per_gram" TO "unit_cost_cents"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_b065eca057bc573e52412b6feba" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "movement_single_owner" CHECK (("roll_id" IS NOT NULL) <> ("stock_item_id" IS NOT NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "movement_single_owner"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_b065eca057bc573e52412b6feba"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" RENAME COLUMN "unit_cost_cents" TO "unit_cost_cents_per_gram"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" RENAME COLUMN "quantity" TO "quantity_grams"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP COLUMN "stock_item_id"`);
        // Volta a exigir o dono rolo: se houver movimento de item gravado, o banco recusa aqui,
        // que é o comportamento certo - reverter esta fase com item em estoque perderia dado.
        await queryRunner.query(`ALTER TABLE "inventory_movements" ALTER COLUMN "roll_id" SET NOT NULL`);
    }

}
