import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIssuesAdmitCardToExams1794890471870 implements MigrationInterface {
  name = 'AddIssuesAdmitCardToExams1794890471870';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exams" ADD COLUMN "issues_admit_card" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "issues_admit_card"`);
  }
}
