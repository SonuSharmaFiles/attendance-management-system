'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, User } from 'lucide-react';
import { validatePhotoFile } from '@/lib/validation/schemas';
import { ALLOWED_PHOTO_TYPES } from '@/lib/config';

const MAX_DIMENSION = 512;

/**
 * Shrinks a large photo in the browser before uploading: a 4 MB phone picture
 * becomes a ~50 KB WebP, which makes uploads fast on a mobile connection and
 * keeps Storage usage small. If anything in the pipeline is unsupported, the
 * original file is uploaded unchanged.
 */
async function compressImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function') return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    // Already small and already compact — leave it alone.
    if (scale === 1 && file.size < 300 * 1024) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.85);
    });

    if (!blob || blob.size === 0 || blob.size >= file.size) return file;
    return new File([blob], 'profile.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

interface ProfilePhotoProps {
  photoUrl: string | null;
  fullName: string;
  /** Employees post to their own endpoint; admins post on behalf of an employee. */
  endpoint?: string;
  employeeId?: string;
  onUploaded: (url: string) => void;
  size?: 'md' | 'lg';
  editable?: boolean;
}

export function ProfilePhoto({
  photoUrl,
  fullName,
  endpoint = '/api/profile/photo',
  employeeId,
  onUploaded,
  size = 'lg',
  editable = true,
}: ProfilePhotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const dimension = size === 'lg' ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-16 w-16';

  async function handleFile(file: File) {
    const validationError = validatePhotoFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploading(true);
    try {
      const prepared = await compressImage(file);
      const formData = new FormData();
      formData.append('photo', prepared);
      if (employeeId) formData.append('employeeId', employeeId);

      const response = await fetch(endpoint, { method: 'POST', body: formData });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { profilePhotoUrl: string } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast.error(
          payload && 'error' in payload ? payload.error : 'The photo could not be uploaded.',
        );
        return;
      }

      onUploaded(payload.data.profilePhotoUrl);
      toast.success('Profile photo updated.');
    } catch {
      toast.error('Unable to reach the server. Please check your connection.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative ${dimension} shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-navy-100 shadow-md`}
      >
        {photoUrl ? (
          // A plain <img> keeps this working with any Storage host without
          // configuring next/image remote patterns for each project.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`Profile photo of ${fullName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-navy-500"
            role="img"
            aria-label={`No profile photo for ${fullName}`}
          >
            <User aria-hidden className="h-1/2 w-1/2" />
          </div>
        )}

        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-900/60">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-white" />
            <span className="sr-only">Uploading photo</span>
          </div>
        ) : null}
      </div>

      {editable ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_PHOTO_TYPES.join(',')}
            className="sr-only"
            id={`photo-input-${employeeId ?? 'self'}`}
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <label
            htmlFor={`photo-input-${employeeId ?? 'self'}`}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-navy-800 transition-colors hover:bg-slate-50 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <Camera aria-hidden className="h-4 w-4" />
            {uploading ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Upload Photo'}
          </label>
        </>
      ) : null}
    </div>
  );
}
