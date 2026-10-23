import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinanceModule1791363270006 implements MigrationInterface {
    name = 'AddFinanceModule1791363270006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "fee_types" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_76bf5373849c44d3bda84d29415" UNIQUE ("name"), CONSTRAINT "PK_13c213789b6c9fc376303db1fb9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "class_fees" ("id" SERIAL NOT NULL, "class_id" integer NOT NULL, "fee_type_id" integer NOT NULL, "amount" integer NOT NULL, CONSTRAINT "PK_6248d061f8043ac7b4884d69e38" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a3c6702aafaaa8184f37cb7542" ON "class_fees"  ("class_id", "fee_type_id") `);
        await queryRunner.query(`CREATE TYPE "public"."expenses_status_enum" AS ENUM('active', 'voided')`);
        await queryRunner.query(`CREATE TABLE "expenses" ("id" SERIAL NOT NULL, "category" character varying NOT NULL, "amount" integer NOT NULL, "date" date NOT NULL, "note" character varying, "created_by" integer, "status" "public"."expenses_status_enum" NOT NULL DEFAULT 'active', "void_reason" character varying, "voided_by" integer, "voided_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "student_fees" ("id" SERIAL NOT NULL, "student_id" integer NOT NULL, "fee_type_id" integer NOT NULL, "amount_due" integer NOT NULL, "period_month" integer, "period_year" integer, "note" character varying, "created_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2cec5273eddb36c724e226cf13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9e900ecb20698aa377653cdb85" ON "student_fees"  ("student_id", "fee_type_id", "period_month", "period_year") `);
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('cash', 'bank', 'bkash', 'nagad', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('active', 'voided')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" SERIAL NOT NULL, "student_fee_id" integer NOT NULL, "amount" integer NOT NULL, "method" "public"."payments_method_enum" NOT NULL DEFAULT 'cash', "paid_at" date NOT NULL, "receipt_number" character varying, "received_by" integer, "note" character varying, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'active', "void_reason" character varying, "voided_by" integer, "voided_at" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a6659e5eb1bf3b467c819e7f167" UNIQUE ("receipt_number"), CONSTRAINT "UQ_59dcef70bd19850783c84f840e5" UNIQUE ("idempotency_key"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "teacher_salaries" ("id" SERIAL NOT NULL, "teacher_id" integer NOT NULL, "amount_due" integer NOT NULL, "period_month" integer NOT NULL, "period_year" integer NOT NULL, "note" character varying, "created_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c3bd59d986e1ee7a993506d17e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e1f84451b0456c5591a49d004" ON "teacher_salaries"  ("teacher_id", "period_month", "period_year") `);
        await queryRunner.query(`CREATE TYPE "public"."salary_payments_method_enum" AS ENUM('cash', 'bank', 'bkash', 'nagad', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."salary_payments_status_enum" AS ENUM('active', 'voided')`);
        await queryRunner.query(`CREATE TABLE "salary_payments" ("id" SERIAL NOT NULL, "teacher_salary_id" integer NOT NULL, "amount" integer NOT NULL, "method" "public"."salary_payments_method_enum" NOT NULL DEFAULT 'cash', "paid_at" date NOT NULL, "receipt_number" character varying, "received_by" integer, "note" character varying, "status" "public"."salary_payments_status_enum" NOT NULL DEFAULT 'active', "void_reason" character varying, "voided_by" integer, "voided_at" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7fa92bbbb4890290b56d457671a" UNIQUE ("receipt_number"), CONSTRAINT "UQ_caa57a477be0da11ac82fe38aa0" UNIQUE ("idempotency_key"), CONSTRAINT "PK_dde0dd5e8632eef035da694183a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "class_fees" ADD CONSTRAINT "FK_3fc67d27beb7537d504c80b9868" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "class_fees" ADD CONSTRAINT "FK_23432226fb1352717163cb35276" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_7c0c012c2f8e6578277c239ee61" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_fees" ADD CONSTRAINT "FK_9e8969b8c743de99403b16b592c" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_fees" ADD CONSTRAINT "FK_e8e31608d1095702a3e5bd5c6d6" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_fees" ADD CONSTRAINT "FK_713241ce1b5d3780b51f927a30a" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_65e5a00b99fea251e787cf46f3f" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_addd19c06574aa904472b8c82bd" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teacher_salaries" ADD CONSTRAINT "FK_899dd3cb12106fed4d03e495178" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teacher_salaries" ADD CONSTRAINT "FK_90befb5f3bfc315b45d4e5d0a91" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "salary_payments" ADD CONSTRAINT "FK_5f77c8ac619870f6e8a97fbbe7d" FOREIGN KEY ("teacher_salary_id") REFERENCES "teacher_salaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "salary_payments" ADD CONSTRAINT "FK_b716b3600460f3d61e475bf467c" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "salary_payments" DROP CONSTRAINT "FK_b716b3600460f3d61e475bf467c"`);
        await queryRunner.query(`ALTER TABLE "salary_payments" DROP CONSTRAINT "FK_5f77c8ac619870f6e8a97fbbe7d"`);
        await queryRunner.query(`ALTER TABLE "teacher_salaries" DROP CONSTRAINT "FK_90befb5f3bfc315b45d4e5d0a91"`);
        await queryRunner.query(`ALTER TABLE "teacher_salaries" DROP CONSTRAINT "FK_899dd3cb12106fed4d03e495178"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_addd19c06574aa904472b8c82bd"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_65e5a00b99fea251e787cf46f3f"`);
        await queryRunner.query(`ALTER TABLE "student_fees" DROP CONSTRAINT "FK_713241ce1b5d3780b51f927a30a"`);
        await queryRunner.query(`ALTER TABLE "student_fees" DROP CONSTRAINT "FK_e8e31608d1095702a3e5bd5c6d6"`);
        await queryRunner.query(`ALTER TABLE "student_fees" DROP CONSTRAINT "FK_9e8969b8c743de99403b16b592c"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_7c0c012c2f8e6578277c239ee61"`);
        await queryRunner.query(`ALTER TABLE "class_fees" DROP CONSTRAINT "FK_23432226fb1352717163cb35276"`);
        await queryRunner.query(`ALTER TABLE "class_fees" DROP CONSTRAINT "FK_3fc67d27beb7537d504c80b9868"`);
        await queryRunner.query(`DROP TABLE "salary_payments"`);
        await queryRunner.query(`DROP TYPE "public"."salary_payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."salary_payments_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e1f84451b0456c5591a49d004"`);
        await queryRunner.query(`DROP TABLE "teacher_salaries"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e900ecb20698aa377653cdb85"`);
        await queryRunner.query(`DROP TABLE "student_fees"`);
        await queryRunner.query(`DROP TABLE "expenses"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3c6702aafaaa8184f37cb7542"`);
        await queryRunner.query(`DROP TABLE "class_fees"`);
        await queryRunner.query(`DROP TABLE "fee_types"`);
    }

}
