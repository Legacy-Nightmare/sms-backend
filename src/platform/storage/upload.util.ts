import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// Shared multer config for every upload endpoint that stores into Supabase
// Storage — files land in memory as a Buffer (file.buffer) instead of on
// local disk, since the disk here is ephemeral on most free hosts and
// StorageService needs the bytes in-process to forward them on anyway.
export function memoryUpload(allowedTypes: string[], maxSize: number) {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, accept: boolean) => void,
    ) => {
      if (!allowedTypes.includes(file.mimetype)) {
        cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
        return;
      }
      cb(null, true);
    },
  };
}

export function randomFileKey(prefix: string, originalName: string): string {
  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
  return `${prefix}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}
