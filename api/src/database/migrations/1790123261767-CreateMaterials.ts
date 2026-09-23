import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMaterials1790123261767 implements MigrationInterface {
    name = 'CreateMaterials1790123261767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // migration:generate também propôs recriar o enum de users.role e a FK de
        // fixed_cost_items, idênticos aos já existentes (ruído do comparador do TypeORM,
        // não uma mudança real); removido para esta migration só criar "materials" (Impact do
        // plano: "nada para migrar em dado existente").
        await queryRunner.query(`CREATE TABLE "materials" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" character varying NOT NULL, "brand" character varying NOT NULL, "color" character varying NOT NULL, "density_g_cm3" double precision NOT NULL, "nozzle_temp_c" double precision NOT NULL, "bed_temp_c" double precision NOT NULL, "needs_drying" boolean NOT NULL, "drying_temperature_c" double precision, "drying_hours" double precision, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2fd1a93ecb222a28bef28663fa0" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "materials"`);
    }

}
