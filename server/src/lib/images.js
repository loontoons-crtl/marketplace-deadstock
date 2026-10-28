import sharp from 'sharp';
import { HttpError } from '../middleware/errors.js';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // raw upload limit
export const MAX_IMAGES_PER_LISTING = 8;
const ALLOWED = new Set(['jpeg', 'png', 'webp']);

// Decodes the upload with sharp, which checks the real file contents (not the name or MIME type),
// then re-encodes it. Re-encoding drops EXIF metadata, including phone GPS coordinates.
export async function processListingImage(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, { failOn: 'error' }).metadata();
  } catch {
    throw new HttpError(400, 'This file is not a supported image. Upload a JPG, PNG or WebP photo.');
  }
  if (!ALLOWED.has(meta.format)) {
    throw new HttpError(400, meta.format === 'heif'
      ? 'iPhone HEIC photos are not supported yet. Choose the photo from the Photos picker (it converts to JPG) or export it as JPG.'
      : 'Upload a JPG, PNG or WebP photo.');
  }
  if ((meta.width || 0) < 400 || (meta.height || 0) < 300) throw new HttpError(400, 'Photo is too small. Use at least 400 × 300 pixels.');
  if ((meta.width || 0) * (meta.height || 0) > 60_000_000) throw new HttpError(400, 'Photo dimensions are too large.');

  const base = sharp(buffer).rotate(); // apply camera orientation, then metadata is discarded
  const [full, thumb] = await Promise.all([
    base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
    base.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 78 }).toBuffer(),
  ]);
  const phash = await differenceHash(buffer);
  return { full: full.data, thumb, width: full.info.width, height: full.info.height, phash, phashParts: phashParts(phash) };
}

// 64-bit difference hash: shrink to 9×8 greyscale and record whether each pixel is brighter than its
// right-hand neighbour. Resized, recompressed or slightly cropped copies of a photo get nearly the same
// hash, so photos reused from another seller can be spotted.
export async function differenceHash(buffer) {
  const px = await sharp(buffer).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0';
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

// Four 16-bit chunks, indexed in MongoDB. Two hashes within 3 bits of each other always share at
// least one identical chunk, so near-duplicates are found with an index lookup instead of a full scan.
export const phashParts = (hex) => [0, 1, 2, 3].map((i) => `${i}:${hex.slice(i * 4, i * 4 + 4)}`);

export function hammingHex(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}
