import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../env';
import { AppError } from '../errors';

/** Absolute path receipts are written to, derived from the server's cwd. */
export const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(EXTENSION_BY_MIME));

function extensionFor(file: Express.Multer.File): string {
  const fromMime = EXTENSION_BY_MIME[file.mimetype];
  if (fromMime) return fromMime;

  const fromName = path.extname(file.originalname).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(fromName) ? fromName : '.bin';
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  // Never trust the client's filename on disk; it is only used for the extension.
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${extensionFor(file)}`),
});

/**
 * Single-file upload for `multipart/form-data` under the field name `file`.
 * Multer errors (size, etc.) are translated by the central error handler.
 */
export const uploadReceipt = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError(422, 'UNSUPPORTED_FILE_TYPE', 'Receipt must be a JPEG, PNG, WebP or HEIC image'));
      return;
    }
    callback(null, true);
  },
}).single('file');

/** Public URL path for a stored file, e.g. "/uploads/9f3....jpg". */
export function receiptUrlFor(file: Express.Multer.File): string {
  return `/uploads/${path.basename(file.path)}`;
}

/** Removes a stored receipt, ignoring an already-missing file. */
export function deleteReceiptByUrl(receiptUrl: string): void {
  const filename = path.basename(receiptUrl);
  const target = path.join(UPLOAD_DIR, filename);

  // Belt and braces: never unlink outside the upload directory.
  if (path.dirname(target) !== UPLOAD_DIR) return;

  fs.rm(target, { force: true }, () => {});
}
