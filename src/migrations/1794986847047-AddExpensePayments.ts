import { MigrationInterface, QueryRunner } from 'typeorm';

// Expenses stop being "money already spent at creation" and become bills:
// expenses.amount is now the amount due, paid off (fully or in part) via
// rows here — same append-only, void-not-edit ledger as salary_payments.
export class AddExpensePayments1794986847047 implements MigrationInterface {
  name = 'AddExpensePayments1794986847047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."expense_payments_method_enum" AS ENUM('cash', 'bank', 'bkash', 'nagad', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expense_payments_status_enum" AS ENUM('active', 'voided')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expense_payments" (
        "id" SERIAL NOT NULL,
        "expense_id" integer NOT NULL,
        "amount" integer NOT NULL,
        "method" "public"."expense_payments_method_enum" NOT NULL DEFAULT 'cash',
        "paid_at" date NOT NULL,
        "receipt_number" character varying,
        "paid_by" integer,
        "note" character varying,
        "status" "public"."expense_payments_status_enum" NOT NULL DEFAULT 'active',
        "void_reason" character varying,
        "voided_by" integer,
        "voided_at" TIMESTAMP WITH TIME ZONE,
        "idempotency_key" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_expense_payments_receipt_number" UNIQUE ("receipt_number"),
        CONSTRAINT "UQ_expense_payments_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "PK_expense_payments" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_payments" ADD CONSTRAINT "FK_expense_payments_expense" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_payments" ADD CONSTRAINT "FK_expense_payments_paid_by" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "expense_payments" DROP CONSTRAINT "FK_expense_payments_paid_by"`);
    await queryRunner.query(`ALTER TABLE "expense_payments" DROP CONSTRAINT "FK_expense_payments_expense"`);
    await queryRunner.query(`DROP TABLE "expense_payments"`);
    await queryRunner.query(`DROP TYPE "public"."expense_payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."expense_payments_method_enum"`);
  }
}
