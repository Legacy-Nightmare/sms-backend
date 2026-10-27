import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Supabase Storage exposes an S3-compatible endpoint per project, so the
// regular AWS S3 SDK works against it unmodified — just pointed at
// Supabase's endpoint/region/credentials instead of AWS. Chosen over
// Cloudflare R2 specifically because Supabase's free tier doesn't require a
// card on file; R2 does, even at $0 usage.
//
// Staging (no Supabase project) points this same S3 client at a self-hosted
// MinIO container instead — same AWS SDK, same env var names. The one thing
// that differs per-provider is the public read URL shape: Supabase serves
// reads from its own REST API under "/object/public/<bucket>", while MinIO
// (and most other S3-compatible stores) just serves "/<bucket>" directly at
// the S3 endpoint itself. STORAGE_PUBLIC_URL_BASE lets staging opt into the
// plain shape without touching the Supabase-shaped default prod relies on.
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    // Copy-pasted straight from Project Settings > Storage > S3 Connection,
    // e.g. "https://<ref>.storage.supabase.co/storage/v1/s3" — not
    // reconstructed from the project ref, since Supabase's storage domain
    // (storage.supabase.co) differs from its main API domain (supabase.co)
    // and isn't worth guessing at.
    const s3Endpoint = this.config.get<string>('SUPABASE_S3_ENDPOINT', '').replace(/\/$/, '');
    const region = this.config.get<string>('SUPABASE_S3_REGION', 'us-east-1');
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET', '');

    const publicUrlBase = this.config.get<string>('STORAGE_PUBLIC_URL_BASE', '').replace(/\/$/, '');
    this.publicUrl = publicUrlBase
      ? `${publicUrlBase}/${this.bucket}`
      : // The public object-read REST API lives on the same host as the S3
        // endpoint, just under /object/public/<bucket> instead of /s3.
        `${s3Endpoint.replace(/\/s3$/, '')}/object/public/${this.bucket}`;

    this.client = new S3Client({
      region,
      endpoint: s3Endpoint,
      // Supabase's S3 endpoint is one host shared by every project, with the
      // bucket named in the path (not a bucket-specific subdomain) — the SDK
      // must be told to address it that way instead of the AWS-default
      // virtual-hosted style.
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('SUPABASE_S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('SUPABASE_S3_SECRET_ACCESS_KEY', ''),
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
    return `${this.publicUrl}/${key}`;
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
