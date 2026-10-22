import type { IsIgnoredPath } from './types';

const GIT_FATAL_EXIT_CODE = 128;
const TEST_FILE_PATTERN = /(?:[._](?:test|spec)|-spec|\.test-d|\.cy)\.[cm]?[jt]sx?$/;
const TEST_DIRECTORY_NAMES = new Set([
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'e2e',
  'test',
  'testing',
  'tests',
]);
const GENERATED_DIRECTORY_NAMES = new Set(['dist', 'build', 'out', 'coverage']);

let isGitUnavailable = false;

/**
 * @param relativePath - Workspace-relative path with '/' separators
 * @returns The path up to and including the first 'dist', 'build', 'out' or 'coverage' directory, or 'undefined' when there is none
 */
export function findGeneratedOutputDirectory(relativePath: string): string | undefined {
  const segments = relativePath.split('/');
  const generatedSegmentIndex = segments
    .slice(0, -1)
    .findIndex((segment) => GENERATED_DIRECTORY_NAMES.has(segment));

  if (generatedSegmentIndex === -1) {
    return;
  }

  return segments.slice(0, generatedSegmentIndex + 1).join('/');
}

/**
 * @param relativePath - Workspace-relative path with '/' separators
 * @returns Whether the file name ends in '.test', '_test', '.spec', '_spec', '-spec', '.test-d' or
 * '.cy', or a directory is '__tests__', '__mocks__', '__fixtures__', 'test', 'tests', 'testing' or 'e2e'
 */
export function isTestFile(relativePath: string): boolean {
  return (
    TEST_FILE_PATTERN.test(relativePath) ||
    relativePath
      .split('/')
      .slice(0, -1)
      .some((segment) => TEST_DIRECTORY_NAMES.has(segment))
  );
}

/**
 * Matches paths under 'dist', 'build', 'out' or 'coverage', plus paths git ignores. Git is asked
 * once for all 'relativePaths'; outside a git repository only the directory rule applies.
 */
export function createIgnoredPathMatcher(
  root: string,
  relativePaths: readonly string[],
): IsIgnoredPath {
  const gitCandidatePaths = [...new Set(relativePaths)].filter(
    (relativePath) => !isGeneratedOutputPath(relativePath),
  );
  const gitIgnoredPaths = listGitIgnoredPaths(root, gitCandidatePaths);

  return (relativePath) =>
    isGeneratedOutputPath(relativePath) || gitIgnoredPaths.has(relativePath);
}

function isGeneratedOutputPath(relativePath: string): boolean {
  return Boolean(findGeneratedOutputDirectory(relativePath));
}

function listGitIgnoredPaths(root: string, relativePaths: readonly string[]): ReadonlySet<string> {
  if (relativePaths.length === 0 || isGitUnavailable) {
    return new Set();
  }

  const checkIgnoreOutput = runGitCheckIgnore(root, relativePaths);

  if (!checkIgnoreOutput) {
    return new Set();
  }

  return new Set(checkIgnoreOutput.split('\0').filter(Boolean));
}

function runGitCheckIgnore(root: string, relativePaths: readonly string[]): string | undefined {
  try {
    const { exitCode, stdout } = Bun.spawnSync(['git', 'check-ignore', '--stdin', '-z'], {
      cwd: root,
      stdin: Buffer.from(relativePaths.join('\0')),
      stderr: 'ignore',
    });

    if (exitCode === GIT_FATAL_EXIT_CODE) {
      isGitUnavailable = true;
    }

    return exitCode === 0 ? stdout.toString() : undefined;
  } catch {
    isGitUnavailable = true;

    return;
  }
}
