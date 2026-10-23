import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoticeWebsitePublish1792651565154
  implements MigrationInterface
{
  name = 'AddNoticeWebsitePublish1792651565154';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notices" ADD "published_to_website_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notices" DROP COLUMN "published_to_website_at"`,
    );
  }
}
