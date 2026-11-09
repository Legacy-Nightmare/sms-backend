import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// RustFS (self-hosted, S3-compatible object storage) backs file uploads —
// the regular AWS S3 SDK works against it unmodified, just pointed at
// RustFS's endpoint/region/credentials instead of AWS. Uses the same
// RUSTFS_ACCESS_KEY/RUSTFS_SECRET_KEY root credentials docker-compose.yml
// gives the rustfs container itself — one set of credentials, not a
// separate pair for the S3 client.
//
// S3_ENDPOINT and STORAGE_PUBLIC_URL_BASE are deliberately separate
// configs: RustFS's S3 port isn't exposed to the public internet (only
// reachable from the backend over the Docker network, at the default
// http://rustfs:9000), so the SDK talks to it there, while the URL handed
// back to clients/stored in the DB must point at wherever a reverse proxy
// exposes the bucket externally.
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase: string;

  constructor(private readonly config: ConfigService) {
    const s3Endpoint = this.config.get<string>('S3_ENDPOINT', 'http://rustfs:9000').replace(/\/$/, '');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    this.bucket = this.config.get<string>('STORAGE_BUCKET', '');
    this.publicUrlBase = this.config.get<string>('STORAGE_PUBLIC_URL_BASE', '').replace(/\/$/, '');

    this.client = new S3Client({
      region,
      endpoint: s3Endpoint,
      // RustFS is one host shared across all buckets, with the bucket named
      // in the path (not a bucket-specific subdomain) — the SDK must be told
      // to address it that way instead of the AWS-default virtual-hosted
      // style.
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('RUSTFS_ACCESS_KEY', ''),
        secretAccessKey: this.config.get<string>('RUSTFS_SECRET_KEY', ''),
      },
    });
  }

  // Returns the public URL the uploaded object is reachable at. Keys are
  // full paths (e.g. "students/172991-abc.jpg") so everything lands in one
  // bucket with the same folder layout the old uploads/ disk tree used.
  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${this.publicUrlBase}/${this.bucket}/${key}`;
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  // Recovers the key `upload()` returned a public URL for, so a delete flow
  // can clean up the stored object instead of just dropping the DB row and
  // leaking it. Returns null for anything that isn't one of our own current
  // URLs (old Supabase/local-disk URLs from before this storage backend, or
  // a public base URL that's since changed) — those have nothing in this
  // bucket to remove.
  keyFromPublicUrl(url: string): string | null {
    const prefix = `${this.publicUrlBase}/${this.bucket}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}
