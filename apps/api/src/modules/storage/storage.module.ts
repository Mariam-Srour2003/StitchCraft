import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageAdapter } from './local-storage.adapter';
import { STORAGE_ADAPTER } from './storage-adapter';

@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      useFactory: (config: ConfigService) => new LocalStorageAdapter(config),
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
