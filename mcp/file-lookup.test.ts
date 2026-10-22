import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  findDefinition,
  findGeneratedOutputDirectory,
  findReferences,
  findWorkspaceRoot,
  formatOmittedNotice,
  formatReferenceLines,
  isTestFile,
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
const packagesRelativePath = `${examplesDir}/monorepo/packages`;
const greetIndexRelativePath = `${packagesRelativePath}/greet/src/index.ts`;
const appMainRelativePath = `${packagesRelativePath}/app/src/main.ts`;

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

async function exchangeMessages(messages: readonly unknown[]) {
  const server = Bun.spawn(['bun', join(import.meta.dir, 'file-lookup.ts')], {
    cwd: workspaceRoot,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'ignore',
  });

  server.stdin.write(messages.map((message) => `${JSON.stringify(message)}\n`).join(''));
  server.stdin.end();

  const output = await new Response(server.stdout).text();

  return output
    .split('\n')
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
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
    expect(locations).toContain('… omitted 2 in tests');
  });

  test('should list each file once with all of its reference lines', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const locations = findReferences(findFunctionPosition('getUserById', fileText));

    expect(locations).toContain(`${profileRelativePath}:1,4`);
    expect(locations).toContain(`${accountRelativePath}:1,4`);
  });

  test('should bound the definition to its declaration and report the line range', async () => {
    const fileText = await Bun.file(join(workspaceRoot, usersRelativePath)).text();
    const definitionHit = findDefinition(findFunctionPosition('getUserById', fileText));
    const snippetLines = definitionHit.snippet.split('\n');

    expect(definitionHit.location).toBe(`${usersRelativePath}:7-13`);
    expect(snippetLines).toHaveLength(7);
    expect(snippetLines.at(-1)).toBe('}');
  });

  test('should locate the symbol by name when no column is given', () => {
    const definitionHit = findDefinition({
      file: profileRelativePath,
      line: 4,
      symbol: 'getUserById',
    });

    expect(definitionHit.location).toBe(`${usersRelativePath}:7-13`);
  });

  test('should point to the lines that contain a symbol missing from the given line', () => {
    expect(() =>
      findDefinition({ file: profileRelativePath, line: 3, symbol: 'getUserById' }),
    ).toThrow(`getUserById is not on line 3 of ${profileRelativePath}; it is on lines 1, 4`);
  });

  test('should suggest the identifiers on the line when the column hits no symbol', () => {
    expect(() => findDefinition({ file: profileRelativePath, line: 4, character: 1 })).toThrow(
      `No definition at ${profileRelativePath}:4:1. Pass symbol, one of: user, getUserById, userId`,
    );
  });

  test('should use the only identifier on the line when the column misses it', () => {
    const definitionHit = findDefinition({ file: accountRelativePath, line: 1, character: 1 });

    expect(definitionHit.location).toBe(`${usersRelativePath}:7-13`);
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

    expect(locations).toContain(`${probeRelativePath}:1,3`);
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

  test('should group reference lines per file and report hits past the cap', () => {
    const hits = [
      { relativePath: 'a.ts', line: 9 },
      { relativePath: 'b.ts', line: 2 },
      { relativePath: 'a.ts', line: 3 },
      { relativePath: 'c.ts', line: 1 },
    ];

    expect(formatReferenceLines(hits)).toEqual(['a.ts:3,9', 'b.ts:2', 'c.ts:1']);
    expect(formatReferenceLines(hits, 2)).toEqual(['a.ts:9', 'b.ts:2', '… truncated 2']);
  });

  test('should recognize test files by name and by directory', () => {
    const testPaths = [
      'src/user.test.ts',
      'src/user_test.ts',
      'src/user.spec.tsx',
      'test/app.e2e-spec.ts',
      'src/user.test-d.ts',
      'cypress/login.cy.ts',
      'src/__tests__/user.ts',
      'src/__mocks__/user.ts',
      'tests/helpers.ts',
      'src/testing/mockUser.ts',
    ];
    const sourcePaths = ['src/latest.ts', 'src/ab-test.ts', 'src/contest/entry.ts', 'src/test.ts'];

    expect(testPaths.filter((path) => !isTestFile(path))).toEqual([]);
    expect(sourcePaths.filter((path) => isTestFile(path))).toEqual([]);
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

describe('file-lookup in a workspace', () => {
  test('should find references in the other workspace packages', () => {
    const locations = findReferences({ file: greetIndexRelativePath, line: 3, symbol: 'greet' });

    expect(locations.toSorted()).toEqual([`${appMainRelativePath}:1,5`, `${greetIndexRelativePath}:3`]);
  });

  test("should resolve each package's imports with that package's paths", () => {
    const appDefinition = findDefinition({
      file: appMainRelativePath,
      line: 5,
      symbol: 'formatName',
    });
    const greetDefinition = findDefinition({
      file: greetIndexRelativePath,
      line: 4,
      symbol: 'formatName',
    });

    expect(appDefinition.location).toBe(`${packagesRelativePath}/app/src/format.ts:1-3`);
    expect(greetDefinition.location).toBe(`${packagesRelativePath}/greet/src/format.ts:1-3`);
  });

  test('should keep same-named symbols of other packages out of the references', () => {
    const locations = findReferences({
      file: `${packagesRelativePath}/greet/src/format.ts`,
      line: 1,
      symbol: 'formatName',
    });

    expect(locations.toSorted()).toEqual([
      `${packagesRelativePath}/greet/src/format.ts:1`,
      `${greetIndexRelativePath}:1,4`,
    ]);
  });
});

describe('file-lookup server', () => {
  test('should negotiate the protocol, list read-only tools and reject invalid requests', async () => {
    const responses = await exchangeMessages([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't' } },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3 },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'definition',
          arguments: { file: profileRelativePath, line: 4, symbol: 'getUserById' },
        },
      },
    ]);

    expect(responses).toMatchObject([
      { id: 1, result: { protocolVersion: '2025-06-18' } },
      {
        id: 2,
        result: {
          tools: [
            { name: 'definition', annotations: { readOnlyHint: true } },
            { name: 'references', annotations: { readOnlyHint: true } },
          ],
        },
      },
      { id: 3, error: { code: -32600 } },
      { id: 4, result: { content: [{ type: 'text' }] } },
    ]);
    expect(JSON.stringify(responses.at(-1))).toContain(`${usersRelativePath}:7-13`);
  });
});
