import Image from 'next/image';

/**
 * Organisation emblem.
 *
 * The image lives at `public/logo.png`. To change it later, replace that one
 * file — nothing else needs editing. Only use branding your organisation is
 * authorised to display.
 *
 * `size` sets the HEIGHT in pixels. The width follows the image's own
 * proportions, so a non-square emblem is never stretched or squashed.
 */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      // The file's real pixel size. Next.js uses this to serve a sharp image
      // at whatever size the page actually displays it.
      width={105}
      height={99}
      priority
      className={`object-contain ${className}`}
      style={{ height: size, width: 'auto' }}
      // Decorative: the site title next to it carries the meaning.
      aria-hidden
    />
  );
}
