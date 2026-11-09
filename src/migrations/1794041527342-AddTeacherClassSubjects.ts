import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces the free-text `teachers.subject` field (one string per teacher)
// with a proper multi-assignment: a teacher can teach several subjects
// across several classes, each row pointing at one class's own instance of
// a subject (class_subjects).
export class AddTeacherClassSubjects1794041527342 implements MigrationInterface {
  name = 'AddTeacherClassSubjects1794041527342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "subject"`);

    await queryRunner.query(
      `CREATE TABLE "teacher_class_subjects" (
        "id" SERIAL NOT NULL,
        "teacher_id" integer NOT NULL,
        "class_subject_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_class_subjects" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_teacher_class_subjects_unique" ON "teacher_class_subjects" ("teacher_id", "class_subject_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_class_subjects" ADD CONSTRAINT "FK_teacher_class_subjects_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_class_subjects" ADD CONSTRAINT "FK_teacher_class_subjects_class_subject" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "teacher_class_subjects"`);
    await queryRunner.query(`ALTER TABLE "teachers" ADD "subject" character varying`);
  }
}
