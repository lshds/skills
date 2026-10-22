import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const NODE_MODULES_DIRECTORY_NAME = 'node_modules';

/**
 * A lookup failure caused by the request or the workspace state. Any other error is a server bug
 * and is logged to stderr.
 */
export class LookupError extends Error {}

export function normalizePath(filePath: string): string {
  return resolve(filePath).replaceAll('\\', '/');
}

export function toRealPathIfExists(filePath: string): string {
  try {
    return normalizePath(realpathSync(filePath));
  } catch {
    return normalizePath(filePath);
  }
}

export function toRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).replaceAll('\\', '/');
}

export function isPathInsideRoot(root: string, filePath: string): boolean {
  const relativePath = toRelativePath(root, filePath);

  return relativePath !== '..' && !relativePath.startsWith('../');
}

export function isNodeModulesPath(relativePath: string): boolean {
  return relativePath.split('/').includes(NODE_MODULES_DIRECTORY_NAME);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
