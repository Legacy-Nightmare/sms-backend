import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1793075485053 implements MigrationInterface {
  name = 'InitialSchema1793075485053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sections" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "class_id" integer NOT NULL, CONSTRAINT "PK_f9749dd3bffd880a497d007e450" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2ebfeb717b0c4f1b9404f58dfd" ON "sections"  ("class_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "classes" ("id" SERIAL NOT NULL, "level" integer NOT NULL, "name" character varying NOT NULL, "tutorial_weight_percent" integer NOT NULL DEFAULT '20', "final_weight_percent" integer NOT NULL DEFAULT '80', CONSTRAINT "UQ_910e357d0c191bde74e1537a94e" UNIQUE ("level"), CONSTRAINT "PK_e207aa15404e9b2ce35910f9f7f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."guardians_relation_enum" AS ENUM('father', 'mother', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "guardians" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "relation" "public"."guardians_relation_enum" NOT NULL DEFAULT 'other', "phone" character varying, "email" character varying, "student_id" integer NOT NULL, CONSTRAINT "PK_3dcf02f3dc96a2c017106f280be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "students" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "code" character varying NOT NULL, "biometric_id" integer NOT NULL, "roll" integer NOT NULL, "class_id" integer NOT NULL, "section_id" integer NOT NULL, "dateOfBirth" character varying, "photo_url" character varying, "isActive" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_75fc8d4dc627f6a1abee8fdb53b" UNIQUE ("code"), CONSTRAINT "UQ_2a9267bc9dcf6240faac398b83e" UNIQUE ("biometric_id"), CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "attendance_logs" ("id" SERIAL NOT NULL, "student_id" integer NOT NULL, "device_sn" character varying, "punch_time" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e78c28cf950bd06d614ae09f26b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e840a90df438b93cfdf7c9a82a" ON "attendance_logs"  ("student_id", "punch_time") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."exams_type_enum" AS ENUM('tutorial', 'final')`,
    );
    await queryRunner.query(
      `CREATE TABLE "exams" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "type" "public"."exams_type_enum" NOT NULL DEFAULT 'final', "class_id" integer NOT NULL, "exam_date" date, "academic_year" character varying, "published_at" TIMESTAMP WITH TIME ZONE, "emailed_count" integer NOT NULL DEFAULT '0', "results_announced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b43159ee3efa440952794b4f53e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subjects" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "class_id" integer NOT NULL, "full_marks" integer NOT NULL DEFAULT '100', CONSTRAINT "PK_1a023685ac2b051b4e557b0b280" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0bcf9952449443dacdf210a0ab" ON "subjects"  ("class_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "marks" ("id" SERIAL NOT NULL, "exam_id" integer NOT NULL, "student_id" integer NOT NULL, "subject_id" integer NOT NULL, "marks_obtained" integer NOT NULL, CONSTRAINT "PK_051deeb008f7449216d568872c6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d9a29767b9715121306011b1e0" ON "marks"  ("exam_id", "student_id", "subject_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "fee_types" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_76bf5373849c44d3bda84d29415" UNIQUE ("name"), CONSTRAINT "PK_13c213789b6c9fc376303db1fb9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "class_fees" ("id" SERIAL NOT NULL, "class_id" integer NOT NULL, "fee_type_id" integer NOT NULL, "amount" integer NOT NULL, CONSTRAINT "PK_6248d061f8043ac7b4884d69e38" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a3c6702aafaaa8184f37cb7542" ON "class_fees"  ("class_id", "fee_type_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'teacher', 'finance')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'teacher', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expenses_status_enum" AS ENUM('active', 'voided')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" SERIAL NOT NULL, "category" character varying NOT NULL, "amount" integer NOT NULL, "date" date NOT NULL, "note" character varying, "created_by" integer, "status" "public"."expenses_status_enum" NOT NULL DEFAULT 'active', "void_reason" character varying, "voided_by" integer, "voided_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "student_fees" ("id" SERIAL NOT NULL, "student_id" integer NOT NULL, "fee_type_id" integer NOT NULL, "amount_due" integer NOT NULL, "period_month" integer, "period_year" integer, "note" character varying, "created_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2cec5273eddb36c724e226cf13" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9e900ecb20698aa377653cdb85" ON "student_fees"  ("student_id", "fee_type_id", "period_month", "period_year") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_method_enum" AS ENUM('cash', 'bank', 'bkash', 'nagad', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('active', 'voided')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" SERIAL NOT NULL, "student_fee_id" integer NOT NULL, "amount" integer NOT NULL, "method" "public"."payments_method_enum" NOT NULL DEFAULT 'cash', "paid_at" date NOT NULL, "receipt_number" character varying, "received_by" integer, "note" character varying, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'active', "void_reason" character varying, "voided_by" integer, "voided_at" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a6659e5eb1bf3b467c819e7f167" UNIQUE ("receipt_number"), CONSTRAINT "UQ_59dcef70bd19850783c84f840e5" UNIQUE ("idempotency_key"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "teacher_salaries" ("id" SERIAL NOT NULL, "teacher_id" integer NOT NULL, "amount_due" integer NOT NULL, "period_month" integer NOT NULL, "period_year" integer NOT NULL, "note" character varying, "created_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c3bd59d986e1ee7a993506d17e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4e1f84451b0456c5591a49d004" ON "teacher_salaries"  ("teacher_id", "period_month", "period_year") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."salary_payments_method_enum" AS ENUM('cash', 'bank', 'bkash', 'nagad', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."salary_payments_status_enum" AS ENUM('active', 'voided')`,
    );
    await queryRunner.query(
      `CREATE TABLE "salary_payments" ("id" SERIAL NOT NULL, "teacher_salary_id" integer NOT NULL, "amount" integer NOT NULL, "method" "public"."salary_payments_method_enum" NOT NULL DEFAULT 'cash', "paid_at" date NOT NULL, "receipt_number" character varying, "received_by" integer, "note" character varying, "status" "public"."salary_payments_status_enum" NOT NULL DEFAULT 'active', "void_reason" character varying, "voided_by" integer, "voided_at" TIMESTAMP WITH TIME ZONE, "idempotency_key" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7fa92bbbb4890290b56d457671a" UNIQUE ("receipt_number"), CONSTRAINT "UQ_caa57a477be0da11ac82fe38aa0" UNIQUE ("idempotency_key"), CONSTRAINT "PK_dde0dd5e8632eef035da694183a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notices" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL, "class_id" integer, "created_by" integer, "published_at" TIMESTAMP WITH TIME ZONE, "published_to_website_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3eb18c29da25d6935fcbe584237" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "gallery_photos" ("id" SERIAL NOT NULL, "image_url" character varying NOT NULL, "caption" character varying, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1eafc909ffac8de65a50960e440" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "institutions" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "caption" character varying, "tone" character varying NOT NULL DEFAULT 'blue', "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0be7539dcdba335470dc05e9690" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "school_profile" ("id" integer NOT NULL, "school_name" character varying NOT NULL, "tagline" character varying, "about_text" text, "address" character varying, "phone" character varying, "email" character varying, "map_url" character varying, "facebook_url" character varying, "youtube_url" character varying, "linkedin_url" character varying, "x_url" character varying, "logo_url" character varying, "hero_image_url" character varying, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bb0313d4bc2957cfb49ceb9611e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "site_documents" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "file_url" character varying NOT NULL, "category" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ad7a2d740aff5dc774ce68f29b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" ADD CONSTRAINT "FK_27db91d7369af6f181412afa99f" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardians" ADD CONSTRAINT "FK_69e793368dac6279adfd6ca55ad" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_de6ad4ae6936dce474e2823984e" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_3e1663d65a2373870a2511d6dc4" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_logs" ADD CONSTRAINT "FK_fbaaf531e57d19703dd3418f62e" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exams" ADD CONSTRAINT "FK_7fe60823f5f2c03867eafba8fa9" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subjects" ADD CONSTRAINT "FK_275ac71cfea88470f4baae99c36" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "marks" ADD CONSTRAINT "FK_8699814252710a57e0fbd5a77e7" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "marks" ADD CONSTRAINT "FK_5226e1592e6291dbe7a07640346" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "marks" ADD CONSTRAINT "FK_13120386acf0b80ecd25fdac3b0" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_fees" ADD CONSTRAINT "FK_3fc67d27beb7537d504c80b9868" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_fees" ADD CONSTRAINT "FK_23432226fb1352717163cb35276" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_7c0c012c2f8e6578277c239ee61" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_fees" ADD CONSTRAINT "FK_9e8969b8c743de99403b16b592c" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_fees" ADD CONSTRAINT "FK_e8e31608d1095702a3e5bd5c6d6" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_fees" ADD CONSTRAINT "FK_713241ce1b5d3780b51f927a30a" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_65e5a00b99fea251e787cf46f3f" FOREIGN KEY ("student_fee_id") REFERENCES "student_fees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_addd19c06574aa904472b8c82bd" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" ADD CONSTRAINT "FK_899dd3cb12106fed4d03e495178" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" ADD CONSTRAINT "FK_90befb5f3bfc315b45d4e5d0a91" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_payments" ADD CONSTRAINT "FK_5f77c8ac619870f6e8a97fbbe7d" FOREIGN KEY ("teacher_salary_id") REFERENCES "teacher_salaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_payments" ADD CONSTRAINT "FK_b716b3600460f3d61e475bf467c" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notices" ADD CONSTRAINT "FK_36a99c70b55a4324197f44cf0dc" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notices" ADD CONSTRAINT "FK_5091560ec8975434a5add94c411" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "school_profile" ("id", "school_name", "tagline", "logo_url") VALUES (1, 'Agradoot Preparatory and High School', 'Learn, Grow, Build a Better Tomorrow', '/logo.jpeg')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notices" DROP CONSTRAINT "FK_5091560ec8975434a5add94c411"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notices" DROP CONSTRAINT "FK_36a99c70b55a4324197f44cf0dc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_payments" DROP CONSTRAINT "FK_b716b3600460f3d61e475bf467c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_payments" DROP CONSTRAINT "FK_5f77c8ac619870f6e8a97fbbe7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" DROP CONSTRAINT "FK_90befb5f3bfc315b45d4e5d0a91"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_salaries" DROP CONSTRAINT "FK_899dd3cb12106fed4d03e495178"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_addd19c06574aa904472b8c82bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_65e5a00b99fea251e787cf46f3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_fees" DROP CONSTRAINT "FK_713241ce1b5d3780b51f927a30a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_fees" DROP CONSTRAINT "FK_e8e31608d1095702a3e5bd5c6d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_fees" DROP CONSTRAINT "FK_9e8969b8c743de99403b16b592c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_7c0c012c2f8e6578277c239ee61"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_fees" DROP CONSTRAINT "FK_23432226fb1352717163cb35276"`,
    );
    await queryRunner.query(
      `ALTER TABLE "class_fees" DROP CONSTRAINT "FK_3fc67d27beb7537d504c80b9868"`,
    );
    await queryRunner.query(
      `ALTER TABLE "marks" DROP CONSTRAINT "FK_13120386acf0b80ecd25fdac3b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "marks" DROP CONSTRAINT "FK_5226e1592e6291dbe7a07640346"`,
    );
    await queryRunner.query(
      `ALTER TABLE "marks" DROP CONSTRAINT "FK_8699814252710a57e0fbd5a77e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subjects" DROP CONSTRAINT "FK_275ac71cfea88470f4baae99c36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exams" DROP CONSTRAINT "FK_7fe60823f5f2c03867eafba8fa9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_logs" DROP CONSTRAINT "FK_fbaaf531e57d19703dd3418f62e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_3e1663d65a2373870a2511d6dc4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_de6ad4ae6936dce474e2823984e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardians" DROP CONSTRAINT "FK_69e793368dac6279adfd6ca55ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sections" DROP CONSTRAINT "FK_27db91d7369af6f181412afa99f"`,
    );
    await queryRunner.query(`DROP TABLE "site_documents"`);
    await queryRunner.query(`DROP TABLE "school_profile"`);
    await queryRunner.query(`DROP TABLE "institutions"`);
    await queryRunner.query(`DROP TABLE "gallery_photos"`);
    await queryRunner.query(`DROP TABLE "notices"`);
    await queryRunner.query(`DROP TABLE "salary_payments"`);
    await queryRunner.query(`DROP TYPE "public"."salary_payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."salary_payments_method_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4e1f84451b0456c5591a49d004"`,
    );
    await queryRunner.query(`DROP TABLE "teacher_salaries"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e900ecb20698aa377653cdb85"`,
    );
    await queryRunner.query(`DROP TABLE "student_fees"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
    await queryRunner.query(`DROP TYPE "public"."expenses_status_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a3c6702aafaaa8184f37cb7542"`,
    );
    await queryRunner.query(`DROP TABLE "class_fees"`);
    await queryRunner.query(`DROP TABLE "fee_types"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d9a29767b9715121306011b1e0"`,
    );
    await queryRunner.query(`DROP TABLE "marks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0bcf9952449443dacdf210a0ab"`,
    );
    await queryRunner.query(`DROP TABLE "subjects"`);
    await queryRunner.query(`DROP TABLE "exams"`);
    await queryRunner.query(`DROP TYPE "public"."exams_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e840a90df438b93cfdf7c9a82a"`,
    );
    await queryRunner.query(`DROP TABLE "attendance_logs"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "guardians"`);
    await queryRunner.query(`DROP TYPE "public"."guardians_relation_enum"`);
    await queryRunner.query(`DROP TABLE "classes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2ebfeb717b0c4f1b9404f58dfd"`,
    );
    await queryRunner.query(`DROP TABLE "sections"`);
  }
}
