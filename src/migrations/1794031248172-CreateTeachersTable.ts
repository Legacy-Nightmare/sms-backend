import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeachersTable1794031248172 implements MigrationInterface {
  name = 'CreateTeachersTable1794031248172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "teachers" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "photo_url" character varying,
        "nid" character varying,
        "date_of_birth" character varying,
        "joining_date" character varying,
        "subject" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teachers" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "teachers"`);
  }
}
