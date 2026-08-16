import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageAdapter } from './storage-adapter';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.rootDir = config.get<string>('STORAGE_LOCAL_DIR') ?? path.join(process.cwd(), 'storage', 'local');
    this.publicBaseUrl = config.get<string>('STORAGE_PUBLIC_BASE_URL') ?? 'http://localhost:3000/api/storage';
  }

  async put(key: string, data: Buffer): Promise<string> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private resolve(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
    return path.join(this.rootDir, normalized);
  }
}
