import { MigrationInterface, QueryRunner } from 'typeorm';

// teacher_salaries.teacher_id originally referenced users(id) (login/staff
// accounts), from before the dedicated teachers roster table existed. The
// Teachers > Salary page now manages salary per roster entry (which carries
// subject/photo/etc that a login account doesn't), so this repoints the FK
// to the real teacher roster. Safe to do outright — both tables are empty in
// every environment this has shipped to.
export class RepointTeacherSalariesToTeachersRoster1794038816874
  implements MigrationInterface
{
  name = 'RepointTeacherSalariesToTeachersRoster1794038816874';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" DROP CONSTRAINT "FK_899dd3cb12106fed4d03e495178"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" ADD CONSTRAINT "FK_899dd3cb12106fed4d03e495178" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" DROP CONSTRAINT "FK_899dd3cb12106fed4d03e495178"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" ADD CONSTRAINT "FK_899dd3cb12106fed4d03e495178" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
