import { MigrationInterface, QueryRunner } from 'typeorm';

// Lets a login account (role=teacher) be linked to its roster entry in
// `teachers`, so the backend can tell which class/subject assignments a
// given logged-in teacher actually has — needed to restrict mark entry to
// only their own assignments instead of any class/subject.
export class AddTeacherLinkToUsers1794286227011 implements MigrationInterface {
  name = 'AddTeacherLinkToUsers1794286227011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "teacher_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_teacher"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "teacher_id"`);
  }
}
