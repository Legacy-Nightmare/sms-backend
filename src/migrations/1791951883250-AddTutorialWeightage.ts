import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorialWeightage1791951883250 implements MigrationInterface {
  name = 'AddTutorialWeightage1791951883250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classes" ADD "tutorial_weight_percent" integer NOT NULL DEFAULT '20'`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD "final_weight_percent" integer NOT NULL DEFAULT '80'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."exams_type_enum" AS ENUM('tutorial', 'final')`,
    );
    await queryRunner.query(
      `ALTER TABLE "exams" ADD "type" "public"."exams_type_enum" NOT NULL DEFAULT 'final'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "public"."exams_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "classes" DROP COLUMN "final_weight_percent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" DROP COLUMN "tutorial_weight_percent"`,
    );
  }
}
