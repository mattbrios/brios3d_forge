import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStockItems1790189659472 implements MigrationInterface {
    name = 'CreateStockItems1790189659472'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."stock_items_category_enum" AS ENUM('insumo', 'peca_reposicao')`);
        await queryRunner.query(`CREATE TABLE "stock_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "category" "public"."stock_items_category_enum" NOT NULL, "name" character varying NOT NULL, "sku" character varying, "unit_of_measure" character varying NOT NULL, "location" character varying, "preferred_supplier_id" uuid, "balance_quantity" double precision NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c427528a56ee9c7e24fdf6edd1f" UNIQUE ("sku"), CONSTRAINT "stock_item_balance_non_negative" CHECK ("balance_quantity" >= 0), CONSTRAINT "PK_52a266aa3e04b8ad1f01088f3f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "stock_item_printers" ("stock_item_id" uuid NOT NULL, "printer_id" uuid NOT NULL, CONSTRAINT "PK_5b23e1836cb49c67f42db490469" PRIMARY KEY ("stock_item_id", "printer_id"))`);
        await queryRunner.query(`ALTER TABLE "stock_items" ADD CONSTRAINT "FK_53eeb50737ad6fe429835e2886f" FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_item_printers" ADD CONSTRAINT "FK_dbe69c402ebaa150ad3e3e83f3c" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_item_printers" ADD CONSTRAINT "FK_c2e4680467e78ef1e476aaa5b06" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_item_printers" DROP CONSTRAINT "FK_c2e4680467e78ef1e476aaa5b06"`);
        await queryRunner.query(`ALTER TABLE "stock_item_printers" DROP CONSTRAINT "FK_dbe69c402ebaa150ad3e3e83f3c"`);
        await queryRunner.query(`ALTER TABLE "stock_items" DROP CONSTRAINT "FK_53eeb50737ad6fe429835e2886f"`);
        await queryRunner.query(`DROP TABLE "stock_item_printers"`);
        await queryRunner.query(`DROP TABLE "stock_items"`);
        await queryRunner.query(`DROP TYPE "public"."stock_items_category_enum"`);
    }

}
