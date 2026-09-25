/**
 * Resolves the project's `@/…` import alias for Node's built-in test runner,
 * matching the `paths` entry in tsconfig.json. Without this, Node cannot load
 * modules that the Next.js bundler resolves for us at build time.
 */
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const projectRoot = pathToFileURL(`${process.cwd()}/`);

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context);

  const base = new URL(specifier.slice(2), projectRoot);
  for (const candidate of [base.pathname, `${base.pathname}.ts`, `${base.pathname}/index.ts`]) {
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
