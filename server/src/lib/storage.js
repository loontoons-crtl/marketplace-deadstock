import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';

// Two interchangeable drivers with the same interface:
//   save(buffers) -> { url, thumbUrl, key }      remove(key)
// 'local' writes to server/uploads (development and tests only).
// 'cloudinary' uploads the already-processed WebP files to Cloudinary.

export const LOCAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const local = {
  async save({ full, thumb }) {
    const key = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await Promise.all([fs.writeFile(path.join(LOCAL_DIR, `${key}.webp`), full), fs.writeFile(path.join(LOCAL_DIR, `${key}-t.webp`), thumb)]);
    return { key, url: `/uploads/${key}.webp`, thumbUrl: `/uploads/${key}-t.webp` };
  },
  async remove(key) {
    if (!/^[a-z0-9]+-[a-f0-9]{16}$/.test(key)) return; // never touch paths we did not create
    await Promise.allSettled([fs.unlink(path.join(LOCAL_DIR, `${key}.webp`)), fs.unlink(path.join(LOCAL_DIR, `${key}-t.webp`))]);
  },
};

let configured = false;
function cld() {
  if (!configured) {
    // The SDK reads CLOUDINARY_URL from the environment.
    cloudinary.config({ secure: true });
    configured = true;
  }
  return cloudinary;
}

const cloud = {
  async save({ full }) {
    const result = await new Promise((resolve, reject) => {
      cld().uploader.upload_stream(
        { folder: 'deadstock/listings', resource_type: 'image', format: 'webp', overwrite: false, unique_filename: true },
        (err, res) => (err ? reject(err) : resolve(res))
      ).end(full);
    });
    // Thumbnails come from a Cloudinary URL transformation instead of a second upload.
    const thumbUrl = cld().url(result.public_id, { secure: true, width: 640, height: 480, crop: 'fill', format: 'webp', quality: 'auto' });
    return { key: result.public_id, url: result.secure_url, thumbUrl };
  },
  async remove(key) {
    if (!key) return;
    await cld().uploader.destroy(key, { resource_type: 'image' });
  },
};

export const storage = config.storageDriver === 'cloudinary' ? cloud : local;
