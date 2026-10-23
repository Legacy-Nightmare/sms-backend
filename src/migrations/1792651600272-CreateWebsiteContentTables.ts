import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebsiteContentTables1792651600272
  implements MigrationInterface
{
  name = 'CreateWebsiteContentTables1792651600272';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Singleton row (id always 1) — the public homepage's about/contact/
    // social-link content, editable from the dashboard's Website Manage
    // page. Seeded here so the public site never has to special-case a
    // missing row.
    await queryRunner.query(
      `CREATE TABLE "school_profile" (
        "id" integer NOT NULL,
        "school_name" character varying NOT NULL,
        "tagline" character varying,
        "about_text" text,
        "address" character varying,
        "phone" character varying,
        "email" character varying,
        "map_url" character varying,
        "facebook_url" character varying,
        "youtube_url" character varying,
        "linkedin_url" character varying,
        "x_url" character varying,
        "logo_url" character varying,
        "hero_image_url" character varying,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_school_profile" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `INSERT INTO "school_profile" ("id", "school_name", "tagline", "logo_url") VALUES (1, 'Agradoot Preparatory and High School', 'Learn, Grow, Build a Better Tomorrow', '/logo.jpeg')`,
    );

    await queryRunner.query(
      `CREATE TABLE "institutions" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "caption" character varying,
        "tone" character varying NOT NULL DEFAULT 'blue',
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_institutions" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "gallery_photos" (
        "id" SERIAL NOT NULL,
        "image_url" character varying NOT NULL,
        "caption" character varying,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gallery_photos" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "site_documents" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "file_url" character varying NOT NULL,
        "category" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_documents" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "site_documents"`);
    await queryRunner.query(`DROP TABLE "gallery_photos"`);
    await queryRunner.query(`DROP TABLE "institutions"`);
    await queryRunner.query(`DROP TABLE "school_profile"`);
  }
}
