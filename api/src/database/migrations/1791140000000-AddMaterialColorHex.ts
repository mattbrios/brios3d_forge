import { MigrationInterface, QueryRunner } from "typeorm";

// Tom da cor do material (feature material-brand-tone, door 1): `color_hex` nula, sem DEFAULT e
// sem CHECK - a API é a única escritora e já recusa outro formato com 400, gravando sempre
// `#rrggbb` minúsculo. Toda linha existente fica "sem tom", sem backfill. O `down()` derruba a
// coluna e o tom gravado não volta.
export class AddMaterialColorHex1791140000000 implements MigrationInterface {
    name = 'AddMaterialColorHex1791140000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "materials" ADD "color_hex" character varying(7)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN "color_hex"`);
    }
}
