import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  capLocations,
  findDefinition,
  findGeneratedOutputDirectory,
  findReferences,
  findWorkspaceRoot,
  formatOmittedNotice,
} from './file-lookup';

const workspaceRoot = findWorkspaceRoot();
const examplesDir = relative(workspaceRoot, join(import.meta.dir, 'examples')).replaceAll('\\', '/');
const usersRelativePath = `${examplesDir}/services/users.ts`;
const profileRelativePath = `${examplesDir}/app/profile.ts`;
const accountRelativePath = `${examplesDir}/app/account.ts`;
const testCallerRelativePath = `${examplesDir}/services/__tests__/users.ts`;
const probeRelativePath = `${examplesDir}/services/lookupProbe.ts`;
const probeAbsolutePath = join(workspaceRoot, probeRelativePath);
const distDirectoryRelativePath = `${examplesDir}/dist`;
const logsDirectoryRelativePath = `${examplesDir}/logs`;
const ignoredProbeDirectoryAbsolutePaths = [
  join(workspaceRoot, distDirectoryRelativePath),
  join(workspaceRoot, logsDirectoryRelativePath),
];
const reExportProbeText = "export { getUserById as probe } from '../services/users';\n";

function findPosition(lineMarker: string, symbolName: string, fileText: string, file: string) {
  const lines = fileText.split('\n');
  const lineIndex = lines.findIndex((line) => line.includes(lineMarker));
  const line = lines[lineIndex];

  if (lineIndex < 0 || line === undefined) {
    throw new Error(`missing ${lineMarker}`);
  }

  const character = line.indexOf(symbolName) + 1;

  return { file, line: lineIndex + 1, character };
}

function findFunctionPosition(functionName: string, fileText: string, file = usersRelativePath) {
  return findPosition(`function ${functionName}`, functionName, fileText, file);
}

function writeIgnoredProbe(directoryRelativePath: string): string {
  const probeFileRelativePath = `${directoryRelativePath}/lookupProbe.ts`;

  mkdirSync(join(workspaceRoot, directoryRelativePath), { recursive: true });
  writeFileSync(join(workspaceRoot, probeFileRelativePath), reExportProbeText);

  return probeFileRelativePath;
}

function removeProbeFiles() {
  if (existsSync(probeAbsolutePath)) {
    unlinkSync(probeAbsolutePath);
  }

  for (const directoryAbsolutePath of ignoredProbeDirectoryAbsolutePaths) {
    rmSync(directoryAbsolutePath, { recursive: true, force: true });
  }
}

afterEach(() => {
  removeProbeFiles();
});

describe('file-lookup', () => {
  test('should list production callers of getUserById and omit tests', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const locations = findReferences(findFunctionPosition('getUserById', fileText));
    const locationsText = locations.join('\n');

    expect(locationsText).toContain(`${profileRelativePath}:`);
    expect(locationsText).toContain(`${accountRelativePath}:`);
    expect(locationsText).not.toContain(testCallerRelativePath);
    expect(locationsText).not.toMatch(/\.test\./);
  });

  test('should resolve the definition of getUserById', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const definitionHit = findDefinition(findFunctionPosition('getUserById', fileText));

    expect(definitionHit.location.startsWith(`${usersRelativePath}:`)).toBe(true);
    expect(definitionHit.snippet).toContain('export async function getUserById');
  });

  test('should keep test files when includeTests is true', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const locations = findReferences({
      ...findFunctionPosition('getUserById', fileText),
      includeTests: true,
    });

    expect(locations.join('\n')).toContain(testCallerRelativePath);
  });

  test('should accept an absolute path inside the workspace', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const locations = findReferences(
      findFunctionPosition('getUserById', fileText, join(workspaceRoot, usersRelativePath)),
    );

    expect(locations.join('\n')).toContain(`${profileRelativePath}:`);
  });

  test('should reject a path outside the workspace', () => {
    expect(() => findReferences({ file: '/etc/passwd', line: 1, character: 1 })).toThrow(
      /outside the workspace/,
    );
  });

  test('should reject a relative path that escapes the workspace', () => {
    expect(() => findReferences({ file: '../../../etc/passwd', line: 1, character: 1 })).toThrow(
      /outside the workspace/,
    );
  });

  test('should include a file created after the first lookup', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const positionInput = findFunctionPosition('getUserById', fileText);

    findReferences(positionInput);
    writeFileSync(
      probeAbsolutePath,
      "import { getUserById } from './users';\nexport const probe = getUserById;\n",
    );

    const locations = findReferences(positionInput);

    expect(locations.join('\n')).toContain(probeRelativePath);
  });

  test('should see edits to a file that is already in the program', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const positionInput = findFunctionPosition('getUserById', fileText);

    writeFileSync(
      probeAbsolutePath,
      "import { getUserById } from './users';\nexport const probe = getUserById;\n",
    );
    findReferences(positionInput);
    writeFileSync(
      probeAbsolutePath,
      `import { getUserById } from './users';\n// ${'x'.repeat(100)}\nexport const movedProbe = getUserById;\n`,
    );

    const locations = findReferences(positionInput);
    const definitionHit = findDefinition({
      file: probeRelativePath,
      line: 3,
      character: 'export const movedProbe = '.length + 1,
    });

    expect(locations).toContain(`${probeRelativePath}:3`);
    expect(locations).not.toContain(`${probeRelativePath}:2`);
    expect(definitionHit.location.startsWith(`${usersRelativePath}:`)).toBe(true);
  });

  test('should open a file created after the language service was cached', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();

    findReferences(findFunctionPosition('getUserById', fileText));
    writeFileSync(
      probeAbsolutePath,
      "import { getUserById } from './users';\nexport const probe = getUserById;\n",
    );

    const definitionHit = findDefinition({
      file: probeRelativePath,
      line: 2,
      character: 'export const probe = '.length + 1,
    });

    expect(definitionHit.location.startsWith(`${usersRelativePath}:`)).toBe(true);
  });

  test('should resolve example files inside the workspace root', () => {
    expect(existsSync(join(workspaceRoot, usersRelativePath))).toBe(true);
    expect(workspaceRoot.endsWith('/.cursor')).toBe(false);
  });

  test('should append a truncation notice when locations exceed the cap', () => {
    const locations = capLocations(['a:1', 'b:2', 'c:3'], 2);

    expect(locations).toEqual(['a:1', 'b:2', '… truncated 1']);
  });

  test('should omit node_modules hits without an omitted notice', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const positionInput = findPosition('Promise<User>', 'Promise', fileText, usersRelativePath);
    const locations = findReferences(positionInput);

    expect(locations).toContain(`${usersRelativePath}:${positionInput.line}`);
    expect(locations.some((location) => location.startsWith('node_modules/'))).toBe(false);
    expect(locations.join('\n')).not.toContain('omitted');
  });

  test('should omit build output and report its directory', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const distProbeRelativePath = writeIgnoredProbe(distDirectoryRelativePath);
    const locations = findReferences(findFunctionPosition('getUserById', fileText));

    expect(locations.join('\n')).not.toContain(distProbeRelativePath);
    expect(locations.at(-1)).toBe(`… omitted 1 in ignored paths (${distDirectoryRelativePath})`);
  });

  test('should omit files ignored by .gitignore rules', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const logsProbeRelativePath = writeIgnoredProbe(logsDirectoryRelativePath);
    const locations = findReferences(findFunctionPosition('getUserById', fileText));

    expect(locations.join('\n')).not.toContain(logsProbeRelativePath);
    expect(locations.at(-1)).toBe(`… omitted 1 in ignored paths (${logsDirectoryRelativePath})`);
  });

  test('should prefer a definition outside ignored paths', () => {
    const distDirectoryAbsolutePath = join(workspaceRoot, distDirectoryRelativePath);
    const usageLine = 'declare const lookupProbeTwin: LookupProbeTwin;';

    mkdirSync(distDirectoryAbsolutePath, { recursive: true });
    writeFileSync(
      join(distDirectoryAbsolutePath, 'lookupProbe.ts'),
      'interface LookupProbeTwin { fromDist: string }\n',
    );
    writeFileSync(
      probeAbsolutePath,
      `interface LookupProbeTwin { fromSource: string }\n${usageLine}\n`,
    );

    const definitionHit = findDefinition({
      file: probeRelativePath,
      line: 2,
      character: usageLine.lastIndexOf('LookupProbeTwin') + 1,
    });

    expect(definitionHit.location).toBe(`${probeRelativePath}:1`);
  });

  test('should find the generated output directory by exact segment', () => {
    expect(findGeneratedOutputDirectory('dist/a.ts')).toBe('dist');
    expect(findGeneratedOutputDirectory('src/build/a.ts')).toBe('src/build');
    expect(findGeneratedOutputDirectory('packages/a/dist/types/x.d.ts')).toBe('packages/a/dist');
    expect(findGeneratedOutputDirectory('src/builder.ts')).toBeUndefined();
    expect(findGeneratedOutputDirectory('src/build.ts')).toBeUndefined();
  });

  test('should list unique sorted directories in the omitted notice', () => {
    expect(formatOmittedNotice(['dist', 'app/build', 'dist'], 3)).toBe(
      '… omitted 3 in ignored paths (app/build, dist)',
    );
    expect(formatOmittedNotice(['g', 'f', 'e', 'd', 'c', 'b', 'a'], 9)).toBe(
      '… omitted 9 in ignored paths (a, b, c, d, e, +2 more)',
    );
  });
});
