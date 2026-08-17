import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { AuthModule } from './modules/auth/auth.module';
import { ConversionModule } from './modules/conversion/conversion.module';
import { ExportModule } from './modules/export/export.module';
import { PalettesModule } from './modules/palettes/palettes.module';
import { PatternsModule } from './modules/patterns/patterns.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // apps/api:serve (nest start --watch) always runs with cwd=apps/api, but
    // .env lives at the repo root (single source, shared with docker-compose's
    // own var list) - '../../.env' is the one that actually resolves there;
    // '.env' stays first so a direct repo-root invocation still works too.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // BullMQ requires maxRetriesPerRequest: null on any connection it manages.
        connection: new IORedis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    PatternsModule,
    PalettesModule,
    ConversionModule,
    ExportModule,
  ],
})
export class AppModule {}
