import type { MetadataRoute } from 'next';

/**
 * This is an internal system holding staff records. Nothing here should ever be
 * crawled or indexed, so everything is disallowed for every crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
