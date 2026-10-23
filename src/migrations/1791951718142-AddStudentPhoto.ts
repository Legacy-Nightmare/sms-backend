import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentPhoto1791951718142 implements MigrationInterface {
  name = 'AddStudentPhoto1791951718142';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "students" ADD "photo_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "photo_url"`);
  }
}
