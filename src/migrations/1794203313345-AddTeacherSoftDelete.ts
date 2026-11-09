import { MigrationInterface, QueryRunner } from 'typeorm';

// Removing a teacher used to be a hard DELETE, which cascaded through
// ON DELETE CASCADE and destroyed teacher_class_subjects assignments,
// teacher_salaries rows, and every salary_payments receipt tied to them —
// silently wiping paid-salary history. "Remove" now soft-deletes instead:
// the row stays, so everything still joining against teachers(id) (the
// Teacher Salary report's raw SQL joins, assignment history) keeps
// resolving correctly; the roster just stops listing it.
export class AddTeacherSoftDelete1794203313345 implements MigrationInterface {
  name = 'AddTeacherSoftDelete1794203313345';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD COLUMN "deleted_at" TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "deleted_at"`);
  }
}
