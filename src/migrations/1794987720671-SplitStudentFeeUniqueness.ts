import { MigrationInterface, QueryRunner } from 'typeorm';

// Root-cause fix: the single unique index on (student_id, fee_type_id,
// period_month, period_year) was blocking a second Exam Fee bill for a
// different exam whenever the period happened to match an earlier one —
// billing a second exam in the same class silently skipped the fee for
// every student already billed for a prior exam that period, with no
// error surfaced (bulkApply/create treat a unique violation as "already
// billed, skip"). Exam Fee bills are per-exam, not per-period, so they
// need their own uniqueness keyed on exam_id instead.
export class SplitStudentFeeUniqueness1794987720671 implements MigrationInterface {
  name = 'SplitStudentFeeUniqueness1794987720671';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_9e900ecb20698aa377653cdb85"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_student_fees_period_unique" ON "student_fees" ("student_id", "fee_type_id", "period_month", "period_year") WHERE "exam_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_student_fees_exam_unique" ON "student_fees" ("student_id", "fee_type_id", "exam_id") WHERE "exam_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_student_fees_exam_unique"`);
    await queryRunner.query(`DROP INDEX "IDX_student_fees_period_unique"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9e900ecb20698aa377653cdb85" ON "student_fees" ("student_id", "fee_type_id", "period_month", "period_year")`,
    );
  }
}
