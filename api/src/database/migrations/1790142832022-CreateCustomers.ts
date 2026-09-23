import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomers1790142832022 implements MigrationInterface {
    name = 'CreateCustomers1790142832022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // migration:generate também propôs recriar a FK de fixed_cost_items e o enum de
        // users.role, idênticos aos já existentes (ruído do comparador do TypeORM, não uma
        // mudança real); removido para esta migration só criar "customers" (Impact do plano:
        // "nada para migrar em dado existente").
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "document" character varying, "phone" character varying, "email" character varying, "address" character varying, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_68c9c024a07c49ad6a2072d23c6" UNIQUE ("document"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "customers"`);
    }

}
