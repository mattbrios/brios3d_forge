import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInventoryMovements1790174650720 implements MigrationInterface {
    name = 'CreateInventoryMovements1790174650720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."inventory_movements_type_enum" AS ENUM('entrada', 'consumo', 'perda', 'ajuste')`);
        await queryRunner.query(`CREATE TABLE "inventory_movements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "roll_id" uuid NOT NULL, "type" "public"."inventory_movements_type_enum" NOT NULL, "quantity_grams" double precision NOT NULL, "unit_cost_cents_per_gram" double precision, "reason" text, "user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d7597827c1dcffae889db3ab873" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_541d057210bb9ef6663eb215742" FOREIGN KEY ("roll_id") REFERENCES "filament_rolls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_63cca4adcd28b6fe19bc4ceb22f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_63cca4adcd28b6fe19bc4ceb22f"`);
        await queryRunner.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_541d057210bb9ef6663eb215742"`);
        await queryRunner.query(`DROP TABLE "inventory_movements"`);
        await queryRunner.query(`DROP TYPE "public"."inventory_movements_type_enum"`);
    }

}
