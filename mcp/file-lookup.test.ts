import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { capLocations, findDefinition, findReferences, findWorkspaceRoot } from './file-lookup';

const workspaceRoot = findWorkspaceRoot();
const examplesDir = relative(workspaceRoot, join(import.meta.dir, 'examples')).replaceAll('\\', '/');
const usersRelativePath = `${examplesDir}/services/users.ts`;
const profileRelativePath = `${examplesDir}/app/profile.ts`;
const accountRelativePath = `${examplesDir}/app/account.ts`;
const testCallerRelativePath = `${examplesDir}/services/__tests__/users.ts`;
const probeRelativePath = `${examplesDir}/services/lookupProbe.ts`;
const probeAbsolutePath = join(workspaceRoot, probeRelativePath);

function findFunctionPosition(functionName: string, fileText: string, file = usersRelativePath) {
  const lines = fileText.split('\n');
  const lineIndex = lines.findIndex((line) => line.includes(`function ${functionName}`));
  const line = lines[lineIndex];

  if (lineIndex < 0 || line === undefined) {
    throw new Error(`missing ${functionName}`);
  }

  const character = line.indexOf(functionName) + 1;

  return { file, line: lineIndex + 1, character };
}

function removeProbeFile() {
  if (existsSync(probeAbsolutePath)) {
    unlinkSync(probeAbsolutePath);
  }
}

afterEach(() => {
  removeProbeFile();
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
});
