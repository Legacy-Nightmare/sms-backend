import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExamResultsAnnouncement1792651565155
  implements MigrationInterface
{
  name = 'AddExamResultsAnnouncement1792651565155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exams" ADD "results_announced_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exams" DROP COLUMN "results_announced_at"`,
    );
  }
}
