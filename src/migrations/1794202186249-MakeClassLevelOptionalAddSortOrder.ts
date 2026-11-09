import { MigrationInterface, QueryRunner } from 'typeorm';

// Classes were previously required to have a unique numeric "level" (1-10),
// used both as the display label ("Class 6") and the sort key. Pre-primary
// classes (Play, KG, Nursery) have no natural number, so `level` becomes
// optional and purely informational; `sort_order` is the new, always-set
// ordering key for every class regardless of whether it has a level.
// Existing rows get `sort_order = level` so current ordering is preserved.
export class MakeClassLevelOptionalAddSortOrder1794202186249
  implements MigrationInterface
{
  name = 'MakeClassLevelOptionalAddSortOrder1794202186249';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "classes" ADD COLUMN "sort_order" integer`);
    await queryRunner.query(`UPDATE "classes" SET "sort_order" = "level"`);
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "sort_order" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "classes" ALTER COLUMN "level" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "classes" DROP CONSTRAINT "UQ_910e357d0c191bde74e1537a94e"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_classes_level_when_set" ON "classes" ("level") WHERE "level" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_classes_level_when_set"`);
    await queryRunner.query(`ALTER TABLE "classes" ALTER COLUMN "level" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "UQ_910e357d0c191bde74e1537a94e" UNIQUE ("level")`,
    );
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN "sort_order"`);
  }
}
