import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config.js';
import { sql } from '../db.js';
import { slugify } from './text.js';
import { badRequest } from './errors.js';

// Responsive WebP renditions generated for every uploaded image.
export const IMAGE_FORMATS = { thumb: 160, small: 480, medium: 960, large: 1600 };
const MAX_ORIGINAL = 2560;
const IMAGE_TYPES = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

export const UPLOADS_PREFIX = '/uploads/';

export function mediaUrl(relPath) {
  return relPath ? UPLOADS_PREFIX + relPath : '';
}

function datedDir() {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function stemFor(originalName) {
  const base = slugify(path.parse(originalName || '').name, 60) || 'fayl';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function writeFile(relPath, data) {
  const abs = path.join(config.uploadsDir, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return abs;
}

function sniffVideo(buf) {
  if (buf.length > 12 && buf.toString('ascii', 4, 8) === 'ftyp') return { ext: 'mp4', mime: 'video/mp4' };
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return { ext: 'webm', mime: 'video/webm' };
  return null;
}

/**
 * Stores an uploaded file and its renditions, returning the inserted media row.
 * Images are auto-rotated, stripped of EXIF/GPS metadata and capped in size.
 */
export async function storeUpload({ buffer, originalName, userId = null, alt = '', title = '' }) {
  const video = sniffVideo(buffer);
  const dir = datedDir();
  const stem = stemFor(originalName);

  if (video) {
    if (buffer.length > config.maxVideoBytes) throw badRequest(`Video faylı ${config.maxVideoBytes / 1024 / 1024} MB-dan böyük ola bilməz.`);
    const rel = `${dir}/${stem}.${video.ext}`;
    await writeFile(rel, buffer);
    const [row] = await sql`
      INSERT INTO media (kind, path, original_name, mime, size, alt, title, uploaded_by)
      VALUES ('video', ${rel}, ${originalName}, ${video.mime}, ${buffer.length}, ${alt}, ${title}, ${userId})
      RETURNING *`;
    return row;
  }

  if (buffer.length > config.maxImageBytes) throw badRequest(`Şəkil ${config.maxImageBytes / 1024 / 1024} MB-dan böyük ola bilməz.`);

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw badRequest('Fayl tanınmadı. Yalnız JPG, PNG, WebP, GIF, AVIF şəkillər və MP4/WebM videolar qəbul olunur.');
  }
  if (!IMAGE_TYPES.has(meta.format)) {
    throw badRequest('Bu şəkil formatı dəstəklənmir. JPG, PNG, WebP, GIF və ya AVIF yükləyin.');
  }

  const isGif = meta.format === 'gif';
  const ext = meta.format === 'jpeg' ? 'jpg' : meta.format;
  const rel = `${dir}/${stem}.${ext}`;

  let original = buffer;
  let width = meta.width;
  let height = meta.height;
  if (!isGif) {
    const pipeline = sharp(buffer).rotate().resize({ width: MAX_ORIGINAL, height: MAX_ORIGINAL, fit: 'inside', withoutEnlargement: true });
    const encoded = meta.format === 'png'
      ? pipeline.png({ compressionLevel: 9 })
      : meta.format === 'webp'
        ? pipeline.webp({ quality: 88 })
        : meta.format === 'avif'
          ? pipeline.avif({ quality: 60 })
          : pipeline.jpeg({ quality: 88, mozjpeg: true });
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    original = data;
    width = info.width;
    height = info.height;
  }
  await writeFile(rel, original);

  const formats = {};
  for (const [key, w] of Object.entries(IMAGE_FORMATS)) {
    if (key !== 'thumb' && width && width <= w * 0.75) continue; // skip pointless upscales
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: w, height: key === 'thumb' ? w : undefined, fit: key === 'thumb' ? 'cover' : 'inside', withoutEnlargement: key !== 'thumb' })
      .webp({ quality: key === 'thumb' ? 70 : 80 })
      .toBuffer({ resolveWithObject: true });
    const fRel = `${dir}/${stem}-${key}.webp`;
    await writeFile(fRel, data);
    formats[key] = { path: fRel, width: info.width, height: info.height, size: info.size };
  }

  const mime = meta.format === 'jpeg' ? 'image/jpeg' : `image/${meta.format}`;
  const [row] = await sql`
    INSERT INTO media (kind, path, original_name, mime, size, width, height, alt, title, formats, uploaded_by)
    VALUES ('image', ${rel}, ${originalName}, ${mime}, ${original.length}, ${width}, ${height}, ${alt}, ${title}, ${sql.json(formats)}, ${userId})
    RETURNING *`;
  return row;
}

export async function deleteMediaFiles(media) {
  const paths = [media.path, ...Object.values(media.formats || {}).map((f) => f.path)];
  await Promise.all(paths.map((p) => fs.rm(path.join(config.uploadsDir, p), { force: true })));
}

// Public shape of a media row (URLs only, never filesystem paths).
export function presentMedia(m) {
  if (!m) return null;
  const formats = {};
  for (const [k, f] of Object.entries(m.formats || {})) {
    formats[k] = { url: mediaUrl(f.path), width: f.width, height: f.height };
  }
  return {
    id: m.id,
    kind: m.kind,
    url: mediaUrl(m.path),
    mime: m.mime,
    width: m.width,
    height: m.height,
    size: m.size,
    alt: m.alt,
    title: m.title,
    caption: m.caption,
    formats,
  };
}

// Best URL for a target width, falling back to the original.
export function pickFormat(m, preferred = 'large') {
  if (!m) return '';
  const order = ['thumb', 'small', 'medium', 'large'];
  const f = m.formats || {};
  const start = order.indexOf(preferred);
  for (let i = start; i < order.length; i++) if (f[order[i]]) return mediaUrl(f[order[i]].path);
  for (let i = start - 1; i >= 0; i--) if (f[order[i]]) return mediaUrl(f[order[i]].path);
  return mediaUrl(m.path);
}

export function srcset(m) {
  if (!m) return '';
  return ['small', 'medium', 'large']
    .filter((k) => m.formats?.[k])
    .map((k) => `${mediaUrl(m.formats[k].path)} ${m.formats[k].width}w`)
    .join(', ');
}

// ---------------------------------------------------------------- review photos
// Customer uploads: only still images, re-encoded to WebP (drops EXIF/GPS and any
// embedded payload), the original is never kept. Max 8 MB / 40 MP per file.
export const REVIEW_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const REVIEW_PHOTO_MAX = 4;
const REVIEW_PHOTO_TYPES = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

export async function storeReviewImage(buffer) {
  if (!buffer?.length) throw badRequest('Şəkil faylı boşdur.');
  if (buffer.length > REVIEW_PHOTO_MAX_BYTES) throw badRequest('Hər şəkil ən çox 8 MB ola bilər.');
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw badRequest('Şəkil tanınmadı. JPG, PNG, WebP və ya HEIC yükləyin.');
  }
  if (!REVIEW_PHOTO_TYPES.has(meta.format)) throw badRequest('Yalnız JPG, PNG, WebP və ya HEIC şəkillər qəbul olunur.');
  const dir = `reviews/${datedDir()}`;
  const stem = crypto.randomBytes(8).toString('hex');
  const base = () => sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();
  let full, thumb;
  try {
    full = await base().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    thumb = await base().resize({ width: 320, height: 320, fit: 'cover' }).webp({ quality: 72 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest('Şəkil emal edilə bilmədi. Başqa şəkil seçin.');
  }
  const fullRel = `${dir}/${stem}.webp`;
  const thumbRel = `${dir}/${stem}-thumb.webp`;
  await writeFile(fullRel, full.data);
  await writeFile(thumbRel, thumb.data);
  return { full: fullRel, thumb: thumbRel, width: full.info.width, height: full.info.height };
}

export async function deleteReviewImageFiles(rows) {
  const paths = rows.flatMap((r) => [r.full_path, r.thumb]).filter(Boolean);
  await Promise.all(paths.map((p) => fs.rm(path.join(config.uploadsDir, p), { force: true })));
}
