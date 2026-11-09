import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherSalaryColumn1794039792333 implements MigrationInterface {
  name = 'AddTeacherSalaryColumn1794039792333';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" ADD "salary" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "salary"`);
  }
}
