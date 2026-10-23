import { MigrationInterface, QueryRunner } from 'typeorm';

// Baseline marker: adopting TypeORM migrations after the schema was already
// built via `synchronize: true`. Verified via `migration:generate` that the
// live DB already matches every entity exactly ("No changes in database
// schema were found"), so there is nothing to diff — this migration exists
// only to seed the migrations table as the starting point. All schema
// changes from here on go through real generated migrations.
export class InitialBaseline1791355867559 implements MigrationInterface {
  name = 'InitialBaseline1791355867559';

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
