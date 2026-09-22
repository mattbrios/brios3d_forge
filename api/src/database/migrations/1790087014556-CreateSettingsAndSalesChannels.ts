import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSettingsAndSalesChannels1790087014556 implements MigrationInterface {
    name = 'CreateSettingsAndSalesChannels1790087014556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "settings" ("id" uuid NOT NULL, "energy_tariff_cents_per_kwh" double precision NOT NULL, "labor_cents_per_hour" double precision NOT NULL, "default_margin_rate" double precision NOT NULL, "failure_rate" double precision NOT NULL, "purge_rate" double precision NOT NULL, "maintenance_cents_per_hour" double precision NOT NULL, "productive_hours_per_month" double precision NOT NULL, CONSTRAINT "PK_settings_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fixed_cost_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "settings_id" uuid NOT NULL, "name" character varying(60) NOT NULL, "monthly_cents" double precision NOT NULL, CONSTRAINT "PK_fixed_cost_items_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sales_channels" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "tax_rate" double precision NOT NULL, "fee_rate" double precision NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_sales_channels_name" UNIQUE ("name"), CONSTRAINT "PK_sales_channels_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "fixed_cost_items" ADD CONSTRAINT "FK_fixed_cost_items_settings_id" FOREIGN KEY ("settings_id") REFERENCES "settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Semeia a linha única de Settings e os 5 canais do CONTEXT (AC 5, door 1): o app nunca
        // sobe com a configuração ausente.
        await queryRunner.query(`INSERT INTO "settings" ("id", "energy_tariff_cents_per_kwh", "labor_cents_per_hour", "default_margin_rate", "failure_rate", "purge_rate", "maintenance_cents_per_hour", "productive_hours_per_month") VALUES ('00000000-0000-0000-0000-000000000101', 0, 0, 0, 0, 0, 0, 1)`);
        await queryRunner.query(`INSERT INTO "sales_channels" ("name", "tax_rate", "fee_rate", "active") VALUES ('Balcão', 0, 0, true), ('Instagram/WhatsApp', 0, 0, true), ('Mercado Livre', 0, 0, true), ('Shopee', 0, 0, true), ('Loja própria', 0, 0, true)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fixed_cost_items" DROP CONSTRAINT "FK_fixed_cost_items_settings_id"`);
        await queryRunner.query(`DROP TABLE "sales_channels"`);
        await queryRunner.query(`DROP TABLE "fixed_cost_items"`);
        await queryRunner.query(`DROP TABLE "settings"`);
    }

}
