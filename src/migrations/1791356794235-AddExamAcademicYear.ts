import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExamAcademicYear1791356794235 implements MigrationInterface {
    name = 'AddExamAcademicYear1791356794235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exams" ADD "academic_year" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN "academic_year"`);
    }

}
