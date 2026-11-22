import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Body parsing is wired manually because ZKTeco devices POST attendance
  // data as plain text (sometimes with no Content-Type at all), which the
  // default JSON/urlencoded parsers silently ignore — so the device routes
  // get their own raw-text parser ahead of the normal JSON one.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  // F-31: the only hop in front of this process is the deploy's nginx, which
  // sets X-Forwarded-For. Without this req.ip is nginx's container IP for
  // every visitor, so IP-keyed rate limits collapse into one shared bucket.
  app.set('trust proxy', 1);
  app.use('/iclock', express.text({ type: () => true, limit: '2mb' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Student photo uploads — plain local disk + static serving, matching the
  // project's no-cloud-storage footprint everywhere else.
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // F-17: /docs-json/yaml is the full route/schema map of the API — fine
  // for local dev, not something a production deploy should serve to
  // anyone who finds the URL.
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('School Management System API')
      .setDescription(
        'Students, classes, ZKTeco device attendance, exams/results, and guardian notices.',
      )
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Server running on port ${port}`);
  if (!isProduction) {
    logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  }
}
bootstrap();
