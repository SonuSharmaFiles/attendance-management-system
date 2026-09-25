import Image from 'next/image';

/**
 * Organisation emblem.
 *
 * `public/logo.svg` ships as a NEUTRAL PLACEHOLDER. Replace that one file with
 * your organisation's authorised emblem and every screen updates. Do not use a
 * government emblem unless you have been authorised to do so.
 */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      priority
      className={className}
      // Decorative: the adjacent site title carries the accessible name.
      aria-hidden
    />
  );
}
