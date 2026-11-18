
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { FileFilterCallback } from 'multer';
import { Request } from 'express';

const uploadDirectory = join(process.cwd(), 'uploads', 'products');

if (!existsSync(uploadDirectory)) {
  mkdirSync(uploadDirectory, { recursive: true });
}

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const productUploadOptions = {
  storage: diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (
  _req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed.',
      ),
      false,
    );
  }

  callback(null, true);
},
};
