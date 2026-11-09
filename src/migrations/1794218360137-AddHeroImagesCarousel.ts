import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces the old single school_profile.hero_image_url (one static image,
// no rotation) with a real ordered collection, backing an auto-advancing
// homepage carousel. Any existing single hero image is carried over as the
// first slide.
export class AddHeroImagesCarousel1794218360137 implements MigrationInterface {
  name = 'AddHeroImagesCarousel1794218360137';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "hero_images" (
        "id" SERIAL NOT NULL,
        "image_url" character varying NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hero_images" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `INSERT INTO "hero_images" ("image_url", "sort_order")
       SELECT "hero_image_url", 0 FROM "school_profile"
       WHERE "hero_image_url" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_profile" DROP COLUMN "hero_image_url"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "school_profile" ADD COLUMN "hero_image_url" character varying`,
    );
    await queryRunner.query(
      `UPDATE "school_profile" SET "hero_image_url" = (
         SELECT "image_url" FROM "hero_images" ORDER BY "sort_order" ASC, "id" ASC LIMIT 1
       )`,
    );
    await queryRunner.query(`DROP TABLE "hero_images"`);
  }
}
