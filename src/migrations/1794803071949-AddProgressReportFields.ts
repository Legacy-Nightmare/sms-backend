import { MigrationInterface, QueryRunner } from 'typeorm';

// Additive and fully backward-compatible: every new column is nullable, so
// existing exams/subjects behave exactly as before. These only come into
// play once an admin explicitly opts a subject into the three-part
// CT1/CT2/Semester-Final progress-report split.
export class AddProgressReportFields1794803071949 implements MigrationInterface {
  name = 'AddProgressReportFields1794803071949';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "exams_component_enum" AS ENUM('ct1', 'ct2', 'semester_final')`,
    );
    await queryRunner.query(
      `ALTER TABLE "exams" ADD COLUMN "component" "exams_component_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN "attendance_period_from" date`);
    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN "attendance_period_to" date`);

    await queryRunner.query(`ALTER TABLE "class_subjects" ADD COLUMN "ct1_full_marks" integer`);
    await queryRunner.query(`ALTER TABLE "class_subjects" ADD COLUMN "ct2_full_marks" integer`);
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD COLUMN "semester_final_full_marks" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP COLUMN "semester_final_full_marks"`,
    );
    await queryRunner.query(`ALTER TABLE "class_subjects" DROP COLUMN "ct2_full_marks"`);
    await queryRunner.query(`ALTER TABLE "class_subjects" DROP COLUMN "ct1_full_marks"`);

    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "attendance_period_to"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "attendance_period_from"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "component"`);
    await queryRunner.query(`DROP TYPE "exams_component_enum"`);
  }
}
