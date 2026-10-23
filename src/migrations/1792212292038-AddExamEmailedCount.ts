import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamEmailedCount1792212292038 implements MigrationInterface {
  name = 'AddExamEmailedCount1792212292038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exams" ADD "emailed_count" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "emailed_count"`);
  }
}
