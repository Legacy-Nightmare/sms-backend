import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Test-only configuration. Set before importing AppModule.
process.env.STORAGE_PUBLIC_URL_BASE = 'http://localhost:3000';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_ACCESS_KEY = 'test-access-key';
process.env.S3_SECRET_KEY = 'test-secret-key';
process.env.JWT_SECRET = 'test-only-jwt-secret-for-e2e';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_DATABASE = 'school_management';
process.env.DB_SSL = 'false';

describe('AppController (e2e)', () => {
  let app: INestApplication | undefined;

  beforeEach(async () => {
    const { AppModule } = await import('./../src/app.module');

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('/ (GET)', async () => {
    if (!app) {
      throw new Error('Nest application was not initialized');
    }

    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
