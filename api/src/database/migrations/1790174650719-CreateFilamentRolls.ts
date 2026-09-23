import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFilamentRolls1790174650719 implements MigrationInterface {
    name = 'CreateFilamentRolls1790174650719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // migration:generate também propôs recriar a FK de fixed_cost_items e o enum de
        // users.role, idênticos aos já existentes (ruído do comparador do TypeORM, não uma
        // mudança real); removido para esta migration só criar "filament_rolls" (Impact do
        // plano: "nada para migrar em dado existente").
        await queryRunner.query(`CREATE TABLE "filament_rolls" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "material_id" uuid NOT NULL, "supplier_id" uuid, "nominal_weight_grams" double precision NOT NULL, "initial_weight_grams" double precision NOT NULL, "balance_grams" double precision NOT NULL, "spool_tare_grams" double precision NOT NULL, "batch" character varying, "purchase_date" date, "opened_at" TIMESTAMP WITH TIME ZONE, "last_dried_at" TIMESTAMP WITH TIME ZONE, "discarded_at" TIMESTAMP WITH TIME ZONE, "location" character varying, "acquisition_cost_cents" double precision NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "balance_non_negative" CHECK ("balance_grams" >= 0), CONSTRAINT "PK_0deffd6ec8a9a696c0e54a04aaa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "filament_rolls" ADD CONSTRAINT "FK_ce0c70b25fbce10e4951632a0a7" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "filament_rolls" ADD CONSTRAINT "FK_18461bce5f6b9e7bf9fcc41d1fb" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "filament_rolls" DROP CONSTRAINT "FK_18461bce5f6b9e7bf9fcc41d1fb"`);
        await queryRunner.query(`ALTER TABLE "filament_rolls" DROP CONSTRAINT "FK_ce0c70b25fbce10e4951632a0a7"`);
        await queryRunner.query(`DROP TABLE "filament_rolls"`);
    }

}
