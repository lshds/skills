import { dirname, join } from 'node:path';

import ts from 'typescript';

import { isPathInsideRoot, isRecord, normalizePath, toRealPathIfExists } from './shared';

const MAX_WORKSPACE_ROOT_WALK_DEPTH = 8;
const PACKAGE_JSON_FILE_NAME = 'package.json';
const PNPM_WORKSPACE_FILE_NAME = 'pnpm-workspace.yaml';
const WORKSPACE_PACKAGE_EXCLUDE_PATTERNS = ['**/node_modules'];

let cachedWorkspaceRoot: string | undefined;

/**
 * Walks up from cwd, then this module, looking for a workspace root.
 *
 * A root is a directory with 'pnpm-workspace.yaml' or a 'package.json' that
 * declares 'workspaces' (npm, yarn, bun). A nested 'package.json' without
 * 'workspaces' is not a root. The result is memoized for the process lifetime.
 *
 * @returns The real path of that directory, or the real path of 'process.cwd()' if none is found
 */
export function findWorkspaceRoot(): string {
  cachedWorkspaceRoot ??= resolveWorkspaceRoot();

  return cachedWorkspaceRoot;
}

/**
 * @returns The nearest directory from 'directory' up to 'root' with 'pnpm-workspace.yaml' or a
 * 'package.json' that declares 'workspaces', or 'undefined' when there is none
 */
export function findWorkspaceManifestDirectory(
  root: string,
  directory: string,
): string | undefined {
  let currentDirectory = directory;

  while (isPathInsideRoot(root, currentDirectory)) {
    if (isWorkspaceRootDirectory(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return;
    }

    currentDirectory = parentDirectory;
  }

  return;
}

/**
 * Lists the package directories a workspace manifest matches with 'package.json' 'workspaces'
 * (array or yarn's '{ packages }') and 'pnpm-workspace.yaml' 'packages'. '!' patterns exclude;
 * 'node_modules' is never searched.
 *
 * @returns Sorted absolute package directories
 */
export function listWorkspacePackageDirectories(manifestDirectory: string): string[] {
  const workspacePatterns = readWorkspacePatterns(manifestDirectory).map(trimWorkspacePattern);
  const includePatterns = workspacePatterns
    .filter((pattern) => !pattern.startsWith('!'))
    .map((pattern) => `${pattern}/${PACKAGE_JSON_FILE_NAME}`);
  const excludePatterns = [
    ...WORKSPACE_PACKAGE_EXCLUDE_PATTERNS,
    ...workspacePatterns
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => pattern.slice(1)),
  ];

  if (includePatterns.length === 0) {
    return [];
  }

  return ts.sys
    .readDirectory(manifestDirectory, ['.json'], excludePatterns, includePatterns)
    .map((packageJsonPath) => normalizePath(dirname(packageJsonPath)))
    .toSorted();
}

function readWorkspacePatterns(manifestDirectory: string): string[] {
  return [
    ...readPackageJsonWorkspacePatterns(join(manifestDirectory, PACKAGE_JSON_FILE_NAME)),
    ...readPnpmWorkspacePatterns(join(manifestDirectory, PNPM_WORKSPACE_FILE_NAME)),
  ];
}

function readPackageJsonWorkspacePatterns(packageJsonPath: string): string[] {
  const workspaces = readJsonRecord(packageJsonPath)?.workspaces;

  return toStringList(isRecord(workspaces) ? workspaces.packages : workspaces);
}

function readPnpmWorkspacePatterns(workspaceFilePath: string): string[] {
  const text = ts.sys.readFile(workspaceFilePath);

  if (!text) {
    return [];
  }

  try {
    const manifest: unknown = Bun.YAML.parse(text);

    return isRecord(manifest) ? toStringList(manifest.packages) : [];
  } catch {
    return [];
  }
}

function trimWorkspacePattern(pattern: string): string {
  return pattern.trim().replace(/^\.\//, '').replace(/\/+$/, '');
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function resolveWorkspaceRoot(): string {
  const markedDirectory =
    walkToWorkspaceMarker(process.cwd()) ?? walkToWorkspaceMarker(import.meta.dir);

  return toRealPathIfExists(markedDirectory ?? process.cwd());
}

function walkToWorkspaceMarker(startDirectory: string): string | undefined {
  let directory = startDirectory;

  for (let depth = 0; depth < MAX_WORKSPACE_ROOT_WALK_DEPTH; depth += 1) {
    if (isWorkspaceRootDirectory(directory)) {
      return directory;
    }

    const parentDirectory = dirname(directory);

    if (parentDirectory === directory) {
      return;
    }

    directory = parentDirectory;
  }

  return;
}

function isWorkspaceRootDirectory(directory: string): boolean {
  if (ts.sys.fileExists(join(directory, PNPM_WORKSPACE_FILE_NAME))) {
    return true;
  }

  return readJsonRecord(join(directory, PACKAGE_JSON_FILE_NAME))?.workspaces !== undefined;
}

function readJsonRecord(filePath: string): Record<string, unknown> | undefined {
  const text = ts.sys.readFile(filePath);

  if (!text) {
    return;
  }

  try {
    const value: unknown = JSON.parse(text);

    return isRecord(value) ? value : undefined;
  } catch {
    return;
  }
}
