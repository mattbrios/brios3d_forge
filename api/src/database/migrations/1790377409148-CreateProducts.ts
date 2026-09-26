import { MigrationInterface, QueryRunner } from "typeorm";

// Fase 13: quatro tabelas novas e vazias, nenhuma tabela existente alterada.
//
// O `migration:generate` também propôs recriar os enums de `users_role`, `stock_items_category` e
// `inventory_movements_type` (churn de ordenação, sem mudança de valor) e derrubar a FK
// `FK_fixed_cost_items_settings_id`. Nada disso pertence a esta fase (mesma decisão da Fase 11).
//
// O índice `product_variants_product_name_unique` é de expressão (`lower(name)`, door 4), então
// não sai do `migration:generate`: foi escrito à mão, e a entidade o declara com
// `synchronize: false`.
export class CreateProducts1790377409148 implements MigrationInterface {
    name = 'CreateProducts1790377409148'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."product_model_platform" AS ENUM('printables', 'makerworld', 'thingiverse')`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "description" text, "model_url" text NOT NULL, "model_platform" "public"."product_model_platform" NOT NULL, "model_external_id" text NOT NULL, "model_title" text, "model_image_url" text, "model_designer" text, "model_license" text, "commercial_use_allowed" boolean, "model_metadata_fetched_at" TIMESTAMP WITH TIME ZONE, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "products_model_identity_unique" ON "products"  ("model_platform", "model_external_id") `);
        await queryRunner.query(`CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL, "name" character varying NOT NULL, "printer_id" uuid NOT NULL, "print_hours" double precision NOT NULL, "prep_hours" double precision NOT NULL, "slicing_hours" double precision NOT NULL, "post_processing_hours" double precision NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "product_variants_product_name_unique" ON "product_variants" ("product_id", lower("name"))`);
        await queryRunner.query(`CREATE TABLE "product_variant_materials" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "variant_id" uuid NOT NULL, "material_id" uuid NOT NULL, "grams" double precision NOT NULL, "position" integer NOT NULL, CONSTRAINT "PK_24a6ede1098dd1c7c871bf8baf4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "product_variant_supplies" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "variant_id" uuid NOT NULL, "stock_item_id" uuid NOT NULL, "quantity" double precision NOT NULL, "position" integer NOT NULL, CONSTRAINT "PK_5a91790fddf7724a06d1978d119" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "product_variant_supplies" ADD CONSTRAINT "FK_6887ddfa74d17d667ae88b91f8a" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variant_supplies" ADD CONSTRAINT "FK_da615d2c3a7dfa2730954d6462e" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_6343513e20e2deab45edfce1316" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_c81a27f821b0ae894e032f500b9" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variant_materials" ADD CONSTRAINT "FK_96e56a74d26856401889b0e0786" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variant_materials" ADD CONSTRAINT "FK_3ebb85840cc956cd2000e71b2ce" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variant_materials" DROP CONSTRAINT "FK_3ebb85840cc956cd2000e71b2ce"`);
        await queryRunner.query(`ALTER TABLE "product_variant_materials" DROP CONSTRAINT "FK_96e56a74d26856401889b0e0786"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_c81a27f821b0ae894e032f500b9"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_6343513e20e2deab45edfce1316"`);
        await queryRunner.query(`ALTER TABLE "product_variant_supplies" DROP CONSTRAINT "FK_da615d2c3a7dfa2730954d6462e"`);
        await queryRunner.query(`ALTER TABLE "product_variant_supplies" DROP CONSTRAINT "FK_6887ddfa74d17d667ae88b91f8a"`);
        await queryRunner.query(`DROP TABLE "product_variant_supplies"`);
        await queryRunner.query(`DROP TABLE "product_variant_materials"`);
        await queryRunner.query(`DROP INDEX "public"."product_variants_product_name_unique"`);
        await queryRunner.query(`DROP TABLE "product_variants"`);
        await queryRunner.query(`DROP INDEX "public"."products_model_identity_unique"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TYPE "public"."product_model_platform"`);
    }

}
