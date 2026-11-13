import { MigrationInterface, QueryRunner } from 'typeorm';

// Account-level active/inactive switch, separate from a teacher's roster
// employment status (teachers.is_active) — this one gates login itself.
export class AddIsActiveToUsers1794609979123 implements MigrationInterface {
  name = 'AddIsActiveToUsers1794609979123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_active"`);
  }
}
