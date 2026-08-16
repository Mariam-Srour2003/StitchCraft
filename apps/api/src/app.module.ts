import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ConversionModule } from './modules/conversion/conversion.module';
import { ExportModule } from './modules/export/export.module';
import { ImagingModule } from './modules/imaging/imaging.module';
import { PalettesModule } from './modules/palettes/palettes.module';
import { PatternsModule } from './modules/patterns/patterns.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    PatternsModule,
    PalettesModule,
    ConversionModule,
    ImagingModule,
    ExportModule,
  ],
})
export class AppModule {}
