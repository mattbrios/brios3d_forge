import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSuppliers1790142882679 implements MigrationInterface {
    name = 'CreateSuppliers1790142882679'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // migration:generate também propôs recriar a FK de fixed_cost_items e o enum de
        // users.role, idênticos aos já existentes (ruído do comparador do TypeORM, não uma
        // mudança real); removido para esta migration só criar "suppliers" (Impact do plano:
        // "nada para migrar em dado existente").
        await queryRunner.query(`CREATE TABLE "suppliers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "document" character varying, "phone" character varying, "email" character varying, "address" character varying, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_473e5a4285b43f7ae5968a4e4f3" UNIQUE ("document"), CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "suppliers"`);
    }

}
