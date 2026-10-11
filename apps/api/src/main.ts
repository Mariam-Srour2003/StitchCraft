import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Pattern saves carry the whole RLE grid plus stitching progress. Express's
  // default 100 kB JSON limit rejects detailed patterns (a converted photo is
  // easily 150 kB+); the worst case - a 500x500 grid where every cell differs,
  // plus its progress grid - is about 4 MB, so 8 MB leaves headroom while
  // still bounding request size.
  app.useBodyParser('json', { limit: '8mb' });

  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:4200', credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Serves whatever LocalStorageAdapter writes (uploads, exports) back out at
  // the same /api/storage/<key> path StorageAdapter.urlFor() hands out.
  // Must match LocalStorageAdapter's own default exactly.
  const config = app.get(ConfigService);
  const storageDir =
    config.get<string>('STORAGE_LOCAL_DIR') ?? path.join(process.cwd(), 'storage', 'local');
  app.useStaticAssets(storageDir, { prefix: '/api/storage' });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`StitchCraft API listening on http://localhost:${port}/api`);
}

bootstrap();
