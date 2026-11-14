import { MigrationInterface, QueryRunner } from 'typeorm';

// Nullable — only Exam Fee bills are linked to an exam (enforced in
// StudentFeesService, not at the DB level, since other fee types never set
// it). SET NULL on delete: removing an exam shouldn't take billing history
// with it.
export class AddExamToStudentFees1794642287768 implements MigrationInterface {
  name = 'AddExamToStudentFees1794642287768';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_fees" ADD COLUMN "exam_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "student_fees" ADD CONSTRAINT "FK_student_fees_exam" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "student_fees" DROP CONSTRAINT "FK_student_fees_exam"`);
    await queryRunner.query(`ALTER TABLE "student_fees" DROP COLUMN "exam_id"`);
  }
}
