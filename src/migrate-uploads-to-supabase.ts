// One-off migration: push every file currently sitting in the local
// uploads/ directory up to Supabase Storage, and repoint the matching DB
// row's URL column at the new URL. Needed because all 5 upload endpoints
// now write straight to Supabase Storage (see platform/storage/), but rows
// created before that switch still hold local-disk paths like
// "/uploads/students/xyz.jpg" which won't exist at all once this runs on a
// host with an ephemeral filesystem.
//
// Run once against each environment that has pre-migration local uploads:
//   npx ts-node -r tsconfig-paths/register src/migrate-uploads-to-supabase.ts
// Safe to re-run — anything already migrated (URL already starts with
// http) is skipped, and any row with no matching local file is skipped with
// a warning rather than failing the whole run.
import 'dotenv/config';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppDataSource } from './data-source';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const s3Endpoint = (process.env.SUPABASE_S3_ENDPOINT ?? '').replace(/\/$/, '');
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? '';
const publicUrl = `${s3Endpoint.replace(/\/s3$/, '')}/object/public/${bucket}`;

const client = new S3Client({
  region: process.env.SUPABASE_S3_REGION ?? 'us-east-1',
  endpoint: s3Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY ?? '',
  },
});

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

async function uploadLocalFile(relativePath: string): Promise<string> {
  // relativePath looks like "students/172991-abc.jpg" (no leading "uploads/")
  const absolutePath = join(UPLOADS_ROOT, relativePath);
  const body = readFileSync(absolutePath);
  const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: relativePath,
      Body: body,
      ContentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
    }),
  );
  return `${publicUrl}/${relativePath}`;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

async function migrateColumn(
  tableLabel: string,
  rows: Array<{ id: number; url: string | null }>,
  localDirRelative: string,
  updateUrl: (id: number, newUrl: string) => Promise<void>,
) {
  let migrated = 0;
  let skippedAlready = 0;
  let skippedMissing = 0;

  for (const row of rows) {
    if (!row.url) continue;
    if (/^https?:\/\//.test(row.url)) {
      skippedAlready++;
      continue;
    }
    const expectedPrefix = `/uploads/${localDirRelative}/`;
    if (!row.url.startsWith(expectedPrefix)) continue; // not a local-upload path (e.g. the default "/logo.jpeg")

    const filename = row.url.slice(expectedPrefix.length);
    const localPath = join(UPLOADS_ROOT, localDirRelative, filename);
    if (!existsSync(localPath)) {
      console.warn(`  [${tableLabel}] id=${row.id}: local file missing (${localPath}), skipping`);
      skippedMissing++;
      continue;
    }

    const newUrl = await uploadLocalFile(`${localDirRelative}/${filename}`);
    await updateUrl(row.id, newUrl);
    migrated++;
  }

  console.log(
    `[${tableLabel}] migrated=${migrated} already-migrated=${skippedAlready} missing-file=${skippedMissing}`,
  );
}

async function main() {
  if (!s3Endpoint || !bucket) {
    console.error('SUPABASE_S3_ENDPOINT / SUPABASE_STORAGE_BUCKET must be set in .env before running this.');
    process.exit(1);
  }

  await AppDataSource.initialize();

  console.log('--- Students ---');
  const students: Array<{ id: number; photo_url: string | null }> = await AppDataSource.query(
    'SELECT id, photo_url FROM students WHERE photo_url IS NOT NULL',
  );
  await migrateColumn(
    'students',
    students.map((s) => ({ id: s.id, url: s.photo_url })),
    'students',
    (id, url) => AppDataSource.query('UPDATE students SET photo_url = $1 WHERE id = $2', [url, id]),
  );

  console.log('--- School profile (logo) ---');
  const profiles: Array<{ id: number; logo_url: string | null }> = await AppDataSource.query(
    'SELECT id, logo_url FROM school_profile',
  );
  await migrateColumn(
    'school_profile.logo',
    profiles.map((p) => ({ id: p.id, url: p.logo_url })),
    'website/logo',
    (id, url) => AppDataSource.query('UPDATE school_profile SET logo_url = $1 WHERE id = $2', [url, id]),
  );

  console.log('--- School profile (hero image) ---');
  const heroes: Array<{ id: number; hero_image_url: string | null }> = await AppDataSource.query(
    'SELECT id, hero_image_url FROM school_profile',
  );
  await migrateColumn(
    'school_profile.hero',
    heroes.map((p) => ({ id: p.id, url: p.hero_image_url })),
    'website/hero',
    (id, url) => AppDataSource.query('UPDATE school_profile SET hero_image_url = $1 WHERE id = $2', [url, id]),
  );

  console.log('--- Gallery photos ---');
  const gallery: Array<{ id: number; image_url: string | null }> = await AppDataSource.query(
    'SELECT id, image_url FROM gallery_photos',
  );
  await migrateColumn(
    'gallery_photos',
    gallery.map((g) => ({ id: g.id, url: g.image_url })),
    'website/gallery',
    (id, url) => AppDataSource.query('UPDATE gallery_photos SET image_url = $1 WHERE id = $2', [url, id]),
  );

  console.log('--- Site documents ---');
  const documents: Array<{ id: number; file_url: string | null }> = await AppDataSource.query(
    'SELECT id, file_url FROM site_documents',
  );
  await migrateColumn(
    'site_documents',
    documents.map((d) => ({ id: d.id, url: d.file_url })),
    'website/documents',
    (id, url) => AppDataSource.query('UPDATE site_documents SET file_url = $1 WHERE id = $2', [url, id]),
  );

  // Any local files with no matching DB row at all (orphaned uploads) are
  // left on disk untouched — not worth guessing what to do with them.
  const localCounts = {
    students: listFiles(join(UPLOADS_ROOT, 'students')).length,
    logo: listFiles(join(UPLOADS_ROOT, 'website/logo')).length,
    hero: listFiles(join(UPLOADS_ROOT, 'website/hero')).length,
    gallery: listFiles(join(UPLOADS_ROOT, 'website/gallery')).length,
    documents: listFiles(join(UPLOADS_ROOT, 'website/documents')).length,
  };
  console.log('\nLocal file counts on disk (for reference):', localCounts);

  await AppDataSource.destroy();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
