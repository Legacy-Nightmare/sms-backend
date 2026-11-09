import { MigrationInterface, QueryRunner } from 'typeorm';

// Subjects used to be created from scratch per class ("Bangla" typed out
// separately for Class 1, Class 2, ...), with no way to reuse one across
// classes. This adds a global subject catalog and turns the old per-class
// `subjects` table into `class_subjects` — a class's own instance of a
// catalog subject, keeping its own copy of `name`/`full_marks` (seeded from
// the catalog's default, editable afterward) so none of the exams/marks
// code that already reads those two columns needs to change at all.
export class AddGlobalSubjectCatalog1794041155296 implements MigrationInterface {
  name = 'AddGlobalSubjectCatalog1794041155296';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Free up the "subjects" name for the new global catalog table — ids,
    // data and the marks.subject_id FK all carry over unchanged by a rename.
    await queryRunner.query(`ALTER TABLE "subjects" RENAME TO "class_subjects"`);
    await queryRunner.query(`ALTER SEQUENCE "subjects_id_seq" RENAME TO "class_subjects_id_seq"`);

    await queryRunner.query(
      `CREATE TABLE "subjects" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "default_full_marks" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subjects_name" UNIQUE ("name"),
        CONSTRAINT "PK_subjects" PRIMARY KEY ("id")
      )`,
    );

    // One catalog row per distinct name already in use — no default marks
    // guessed from existing per-class values, since those can legitimately
    // differ; admins set a catalog default later if they want one.
    await queryRunner.query(
      `INSERT INTO "subjects" ("name") SELECT DISTINCT "name" FROM "class_subjects"`,
    );

    await queryRunner.query(`ALTER TABLE "class_subjects" ADD "subject_id" integer`);
    await queryRunner.query(
      `UPDATE "class_subjects" cs SET "subject_id" = s.id FROM "subjects" s WHERE s.name = cs.name`,
    );
    await queryRunner.query(`ALTER TABLE "class_subjects" ALTER COLUMN "subject_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "class_subjects" ADD CONSTRAINT "FK_class_subjects_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP INDEX "IDX_0bcf9952449443dacdf210a0ab"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_class_subjects_class_subject" ON "class_subjects" ("class_id", "subject_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_class_subjects_class_subject"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0bcf9952449443dacdf210a0ab" ON "class_subjects" ("class_id", "name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_subjects" DROP CONSTRAINT "FK_class_subjects_subject"`,
    );
    await queryRunner.query(`ALTER TABLE "class_subjects" DROP COLUMN "subject_id"`);
    await queryRunner.query(`DROP TABLE "subjects"`);
    await queryRunner.query(`ALTER SEQUENCE "class_subjects_id_seq" RENAME TO "subjects_id_seq"`);
    await queryRunner.query(`ALTER TABLE "class_subjects" RENAME TO "subjects"`);
  }
}
