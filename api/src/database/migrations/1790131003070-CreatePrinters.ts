import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePrinters1790131003070 implements MigrationInterface {
    name = 'CreatePrinters1790131003070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // migration:generate também propôs recriar a FK de fixed_cost_items e o enum de
        // users.role, idênticos aos já existentes (ruído do comparador do TypeORM, não uma
        // mudança real); removido para esta migration só criar "printers" (Impact do plano:
        // "nada para migrar em dado existente").
        await queryRunner.query(`CREATE TABLE "printers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "acquisition_cost_cents" double precision NOT NULL, "lifespan_hours" double precision NOT NULL, "power_watts" double precision NOT NULL, "hourmeter_hours" double precision NOT NULL DEFAULT '0', "nozzles" jsonb NOT NULL, "has_ams" boolean NOT NULL, "ams_slots" integer, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_036bb976f205339f632e2eb0642" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "printers"`);
    }

}
