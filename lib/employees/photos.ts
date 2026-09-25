import { getServiceClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, PHOTO_BUCKET } from '@/lib/config';

/**
 * Profile photo storage.
 *
 * Images live in Supabase Storage, never in Postgres — the employee row only
 * keeps the URL. Uploads always go through this module on the server, so the
 * file type and size are re-checked even if the browser-side check is bypassed.
 */

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Magic-number check, so a renamed .exe cannot pose as an image. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

export async function uploadProfilePhoto(employeeId: string, file: File): Promise<string> {
  if (file.size === 0) {
    throw new AppError('The selected file is empty.', 422);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new AppError(
      `Image is too large. Maximum size is ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB.`,
      422,
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(buffer);

  if (!sniffed || !ALLOWED_PHOTO_TYPES.includes(sniffed as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    throw new AppError('Please upload a JPG, PNG or WebP image.', 422);
  }
  // The declared type must agree with the actual bytes.
  if (file.type && file.type !== sniffed) {
    throw new AppError('The file contents do not match its type. Please try another image.', 422);
  }

  const extension = EXTENSION_BY_TYPE[sniffed];
  // A version suffix busts any CDN/browser cache when the photo is replaced.
  const path = `${employeeId}/profile-${Date.now()}.${extension}`;

  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, buffer, {
    contentType: sniffed,
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.error('[attendance] photo upload failed:', error);
    throw new AppError('The photo could not be uploaded. Please try again.', 502);
  }

  await removeOldPhotos(employeeId, path);

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Keeps the bucket tidy: one current photo per employee folder. */
async function removeOldPhotos(employeeId: string, keepPath: string): Promise<void> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(employeeId);
  if (error || !data) return;

  const stale = data
    .map((item) => `${employeeId}/${item.name}`)
    .filter((path) => path !== keepPath);

  if (stale.length > 0) {
    await supabase.storage.from(PHOTO_BUCKET).remove(stale);
  }
}
