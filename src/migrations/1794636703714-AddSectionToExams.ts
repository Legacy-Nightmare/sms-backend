import { MigrationInterface, QueryRunner } from 'typeorm';

// Nullable — null means "all sections of the class", a specific id means
// the exam (and its marks entry/results) is scoped to just that section.
export class AddSectionToExams1794636703714 implements MigrationInterface {
  name = 'AddSectionToExams1794636703714';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN "section_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "exams" ADD CONSTRAINT "FK_exams_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT "FK_exams_section"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "section_id"`);
  }
}
