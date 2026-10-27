
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const s3Endpoint = this.config
      .get<string>('S3_ENDPOINT', 'http://rustfs:9000')
      .replace(/\/$/, '');

    const region = this.config.get<string>(
      'S3_REGION',
      'us-east-1',
    );

    this.bucket = this.config.get<string>(
      'S3_BUCKET',
      'sms-uploads',
    );

    if (!this.bucket.trim()) {
      throw new Error(
        'S3_BUCKET environment variable is required',
      );
    }

    const publicUrlBase = this.config
      .get<string>('STORAGE_PUBLIC_URL_BASE', '')
      .trim()
      .replace(/\/+$/, '');

    if (!publicUrlBase) {
      throw new Error(
        'STORAGE_PUBLIC_URL_BASE must be configured for public file URLs',
      );
    }

    this.publicUrl = `${publicUrlBase}/${this.bucket}`;

    const accessKeyId = this.config.get<string>(
      'S3_ACCESS_KEY',
      '',
    );

    const secretAccessKey = this.config.get<string>(
      'S3_SECRET_KEY',
      '',
    );

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3_ACCESS_KEY and S3_SECRET_KEY environment variables are required',
      );
    }

    this.client = new S3Client({
      region,
      endpoint: s3Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Upload an object to the configured S3-compatible storage.
   * Returns the object's public URL.
   */
  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
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

  /**
   * Delete an object from the configured storage bucket.
   */
  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
