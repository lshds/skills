import { realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';

import { createParseErrorPayload, drainStdinBuffer, writeJsonRpcMessage } from './stdio-rpc';
import type {
  DefinitionHit,
  IsIgnoredPath,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  OpenedPosition,
  PositionInput,
  ProjectSnapshot,
  ReferenceQuery,
  ResolveWorkspaceHit,
  ToolCallParams,
  ToolName,
  WorkspaceDefinition,
} from './types';

export type { DefinitionHit, PositionInput } from './types';

const PROTOCOL_VERSION = '2024-11-05';
const JSON_RPC_VERSION = '2.0';
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_SERVER_ERROR = -32000;
const SNIPPET_LINE_COUNT = 8;
const REFERENCE_CAP = 40;
const MAX_OMITTED_DIRECTORIES_SHOWN = 5;
const MAX_WORKSPACE_ROOT_WALK_DEPTH = 8;
const GIT_FATAL_EXIT_CODE = 128;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const NODE_MODULES_DIRECTORY_NAME = 'node_modules';
const GENERATED_DIRECTORY_NAMES = new Set(['dist', 'build', 'out', 'coverage']);

const TOOL_NAMES = {
  definition: 'definition',
  references: 'references',
} as const satisfies { readonly [Name in ToolName]: Name };

const INITIALIZE_RESULT = {
  protocolVersion: PROTOCOL_VERSION,
  capabilities: { tools: {} },
  serverInfo: { name: 'file-lookup', version: '0.1.0' },
} as const;

const documentRegistry = ts.createDocumentRegistry();
const languageServicesByConfigPath = new Map<string, ts.LanguageService>();
const projectSnapshotsByConfigPath = new Map<string, ProjectSnapshot>();

let cachedWorkspaceRoot: string | undefined;
let isGitUnavailable = false;

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
 * Resolves the TypeScript definition at a 1-based file position.
 *
 * When several definitions exist, the first one outside ignored paths wins
 * (git-ignored, or under 'dist', 'build', 'out', 'coverage'). Definitions in
 * 'node_modules' are never treated as ignored.
 *
 * @param positionInput - Workspace-relative TS/TSX 'file' with 1-based 'line' and 'character'
 * @returns A {@link DefinitionHit} with a 'path:line' location and a nearby source snippet
 * @throws When the file is outside the workspace, the position is invalid, or no definition exists
 */
export function findDefinition(positionInput: PositionInput): DefinitionHit {
  const { fileName, position, program, root, service } = openPosition(positionInput);
  const definitionInfos = service.getDefinitionAtPosition(fileName, position) ?? [];
  const firstDefinition = definitionInfos[0];

  if (firstDefinition === undefined) {
    throw new Error(
      `No definition at ${positionInput.file}:${positionInput.line}:${positionInput.character}`,
    );
  }

  const workspaceDefinition = pickWorkspaceDefinition(definitionInfos, root, program);

  if (workspaceDefinition === undefined) {
    throw new Error(`Definition is outside the workspace: ${firstDefinition.fileName}`);
  }

  const { definitionInfo, workspaceHit } = workspaceDefinition;

  return {
    location: workspaceHit.location,
    snippet: readSnippet(
      readSourceFile(program, definitionInfo.fileName),
      definitionInfo.textSpan.start,
    ),
  };
}

/**
 * Lists TypeScript reference locations at a 1-based file position.
 *
 * Omits 'node_modules', test files unless 'includeTests', and ignored paths:
 * git-ignored files plus anything under 'dist', 'build', 'out' or 'coverage'.
 *
 * @param positionInput - Workspace-relative TS/TSX 'file' with 1-based 'line' and 'character'. Pass 'includeTests' to keep test files.
 * @returns Workspace-relative 'path:line' strings, at most 40 entries, then '… truncated N' when more exist and '… omitted N in ignored paths (dirs)' when ignored hits were dropped
 * @throws When the file is outside the workspace, the position is invalid, or no references exist
 */
export function findReferences(positionInput: PositionInput): string[] {
  const { fileName, position, program, root, service } = openPosition(positionInput);
  const locations = collectReferenceLocations({
    includeTests: positionInput.includeTests ?? false,
    program,
    referenceEntries: service.getReferencesAtPosition(fileName, position) ?? [],
    root,
  });

  if (locations.length === 0) {
    throw new Error(
      `No references at ${positionInput.file}:${positionInput.line}:${positionInput.character}`,
    );
  }

  return locations;
}

export function formatDefinition(definitionHit: DefinitionHit): string {
  return `${definitionHit.location}\n${definitionHit.snippet}`;
}

/**
 * Keeps the first 'cap' locations and appends a truncation notice when more exist.
 *
 * @param locations - Workspace-relative 'path:line' strings
 * @param cap - Maximum locations to keep
 * @returns At most 'cap' locations, plus '… truncated N' when N locations were omitted
 */
export function capLocations(locations: readonly string[], cap = REFERENCE_CAP): string[] {
  if (locations.length <= cap) {
    return [...locations];
  }

  return [...locations.slice(0, cap), `… truncated ${locations.length - cap}`];
}

/**
 * @param omittedDirectories - Workspace-relative directories of the omitted hits; duplicates are fine
 * @param omittedCount - Number of unique omitted locations
 * @returns '… omitted N in ignored paths (dirs)' with at most 5 sorted directories, then '+N more'
 */
export function formatOmittedNotice(
  omittedDirectories: readonly string[],
  omittedCount: number,
): string {
  const uniqueDirectories = [...new Set(omittedDirectories)].toSorted();
  const shownDirectories = uniqueDirectories.slice(0, MAX_OMITTED_DIRECTORIES_SHOWN);
  const hiddenDirectoryCount = uniqueDirectories.length - shownDirectories.length;
  const directoryLabels =
    hiddenDirectoryCount > 0
      ? [...shownDirectories, `+${hiddenDirectoryCount} more`]
      : shownDirectories;

  return `… omitted ${omittedCount} in ignored paths (${directoryLabels.join(', ')})`;
}

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
    return undefined;
  }

  return segments.slice(0, generatedSegmentIndex + 1).join('/');
}

function openPosition(positionInput: PositionInput): OpenedPosition {
  const root = findWorkspaceRoot();
  const absoluteFilePath = resolveWorkspaceFile(root, positionInput.file);
  const configPath = findConfigPath(absoluteFilePath);

  refreshProject(configPath, absoluteFilePath);

  const service = getLanguageService(configPath);
  const program = service.getProgram();
  const sourceFile = program === undefined ? undefined : findSourceFile(program, absoluteFilePath);

  if (program === undefined || sourceFile === undefined) {
    throw new Error(
      `File is not in the TypeScript project: ${toRelativePath(root, absoluteFilePath)}`,
    );
  }

  return {
    fileName: sourceFile.fileName,
    position: toSourcePosition(sourceFile, positionInput, root),
    program,
    root,
    service,
  };
}

function toSourcePosition(
  sourceFile: ts.SourceFile,
  positionInput: PositionInput,
  root: string,
): number {
  const lineIndex = positionInput.line - 1;
  const characterIndex = positionInput.character - 1;

  if (lineIndex < 0 || characterIndex < 0) {
    throw new Error('line and character are 1-based');
  }

  try {
    return ts.getPositionOfLineAndCharacter(sourceFile, lineIndex, characterIndex);
  } catch {
    throw new Error(
      `Position ${positionInput.line}:${positionInput.character} is out of range in ${toRelativePath(root, sourceFile.fileName)}`,
    );
  }
}

function findSourceFile(program: ts.Program, fileName: string): ts.SourceFile | undefined {
  const sourceFile = program.getSourceFile(fileName);

  if (sourceFile !== undefined) {
    return sourceFile;
  }

  const normalizedFileName = normalizePath(fileName);

  return program
    .getSourceFiles()
    .find((candidate) => normalizePath(candidate.fileName) === normalizedFileName);
}

function readSourceFile(program: ts.Program, fileName: string): ts.SourceFile {
  return (
    program.getSourceFile(fileName) ??
    ts.createSourceFile(fileName, ts.sys.readFile(fileName) ?? '', ts.ScriptTarget.Latest, false)
  );
}

function findConfigPath(fileName: string): string {
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists, 'tsconfig.json');

  if (configPath === undefined) {
    throw new Error(`No tsconfig.json for ${fileName}`);
  }

  return configPath;
}

function refreshProject(configPath: string, requestedFileName?: string): void {
  const previousSnapshot = projectSnapshotsByConfigPath.get(configPath);
  const configMtimeMs = statSync(configPath, { throwIfNoEntry: false })?.mtimeMs ?? 0;
  const parsedConfig = parseConfigFile(configPath);
  const extraFileNames = addExtraFileName(
    previousSnapshot?.extraFileNames ?? new Set<string>(),
    requestedFileName,
  );
  const compilerOptions =
    previousSnapshot?.configMtimeMs === configMtimeMs
      ? previousSnapshot.compilerOptions
      : toLookupCompilerOptions(parsedConfig.options);

  projectSnapshotsByConfigPath.set(configPath, {
    compilerOptions,
    configMtimeMs,
    extraFileNames,
    fileNames: mergeProjectFileNames(parsedConfig.fileNames, extraFileNames),
    version: (previousSnapshot?.version ?? 0) + 1,
  });
}

function addExtraFileName(
  extraFileNames: ReadonlySet<string>,
  fileName: string | undefined,
): ReadonlySet<string> {
  if (fileName === undefined || extraFileNames.has(fileName)) {
    return extraFileNames;
  }

  return new Set([...extraFileNames, fileName]);
}

function mergeProjectFileNames(
  configFileNames: readonly string[],
  extraFileNames: ReadonlySet<string>,
): string[] {
  return [...new Set([...configFileNames.map(normalizePath), ...extraFileNames])];
}

function parseConfigFile(configPath: string): ts.ParsedCommandLine {
  const configFileRead = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFileRead.error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(configFileRead.error.messageText, '\n'));
  }

  return ts.parseJsonConfigFileContent(configFileRead.config, ts.sys, dirname(configPath));
}

function toLookupCompilerOptions(compilerOptions: ts.CompilerOptions): ts.CompilerOptions {
  return {
    ...compilerOptions,
    composite: false,
    incremental: false,
    plugins: [],
    tsBuildInfoFile: undefined,
  };
}

function getLanguageService(configPath: string): ts.LanguageService {
  const cachedService = languageServicesByConfigPath.get(configPath);

  if (cachedService !== undefined) {
    return cachedService;
  }

  const service = createLanguageService(configPath);
  languageServicesByConfigPath.set(configPath, service);

  return service;
}

function createLanguageService(configPath: string): ts.LanguageService {
  const configDirectory = dirname(configPath);
  const readSnapshot = () => projectSnapshotsByConfigPath.get(configPath);

  const host: ts.LanguageServiceHost = {
    directoryExists: ts.sys.directoryExists,
    fileExists: ts.sys.fileExists,
    getCompilationSettings: () => readSnapshot()?.compilerOptions ?? {},
    getCurrentDirectory: () => configDirectory,
    getDefaultLibFileName: (compilerOptionsForLib) =>
      ts.getDefaultLibFilePath(compilerOptionsForLib),
    getDirectories: ts.sys.getDirectories,
    getProjectVersion: () => String(readSnapshot()?.version ?? 0),
    getScriptFileNames: () => [...(readSnapshot()?.fileNames ?? [])],
    getScriptSnapshot: (scriptFileName) => {
      const text = ts.sys.readFile(scriptFileName);

      if (text === undefined) {
        return undefined;
      }

      return ts.ScriptSnapshot.fromString(text);
    },
    getScriptVersion: readScriptVersion,
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  return ts.createLanguageService(host, documentRegistry);
}

function readScriptVersion(fileName: string): string {
  const stats = statSync(fileName, { throwIfNoEntry: false });

  return stats === undefined ? '0' : `${stats.mtimeMs}:${stats.size}`;
}

function resolveWorkspaceFile(root: string, filePath: string): string {
  const absoluteFilePath = normalizePath(resolve(root, filePath));

  if (!isPathInsideRoot(root, absoluteFilePath)) {
    throw new Error('Path is outside the workspace');
  }

  const realFilePath = toRealPathIfExists(absoluteFilePath);

  if (!isPathInsideRoot(root, realFilePath)) {
    throw new Error('Path is outside the workspace');
  }

  if (!ts.sys.fileExists(realFilePath)) {
    throw new Error(`File not found: ${toRelativePath(root, realFilePath)}`);
  }

  return realFilePath;
}

function isPathInsideRoot(root: string, filePath: string): boolean {
  const relativePath = relative(root, filePath).replaceAll('\\', '/');

  return relativePath !== '..' && !relativePath.startsWith('../');
}

function createWorkspaceHitResolver(root: string, program: ts.Program): ResolveWorkspaceHit {
  const relativePathsByFileName = new Map<string, string | undefined>();

  const resolveRelativePath = (fileName: string) => {
    if (relativePathsByFileName.has(fileName)) {
      return relativePathsByFileName.get(fileName);
    }

    const realFilePath = toRealPathIfExists(fileName);
    const relativePath = isPathInsideRoot(root, realFilePath)
      ? toRelativePath(root, realFilePath)
      : undefined;
    relativePathsByFileName.set(fileName, relativePath);

    return relativePath;
  };

  return (fileName, start) => {
    const relativePath = resolveRelativePath(fileName);

    if (relativePath === undefined) {
      return undefined;
    }

    const { line } = ts.getLineAndCharacterOfPosition(readSourceFile(program, fileName), start);

    return { location: `${relativePath}:${line + 1}`, relativePath };
  };
}

function readSnippet(sourceFile: ts.SourceFile, start: number): string {
  const lineStarts = sourceFile.getLineStarts();
  const { line } = ts.getLineAndCharacterOfPosition(sourceFile, start);
  const snippetStart = lineStarts[line] ?? 0;
  const snippetEnd = lineStarts[line + SNIPPET_LINE_COUNT] ?? sourceFile.text.length;

  return sourceFile.text
    .slice(snippetStart, snippetEnd)
    .split(/\r?\n/)
    .slice(0, SNIPPET_LINE_COUNT)
    .join('\n');
}

function pickWorkspaceDefinition(
  definitionInfos: readonly ts.DefinitionInfo[],
  root: string,
  program: ts.Program,
): WorkspaceDefinition | undefined {
  const resolveWorkspaceHit = createWorkspaceHitResolver(root, program);
  const workspaceDefinitions = definitionInfos.flatMap((definitionInfo) => {
    const workspaceHit = resolveWorkspaceHit(definitionInfo.fileName, definitionInfo.textSpan.start);

    return workspaceHit === undefined ? [] : [{ definitionInfo, workspaceHit }];
  });
  const firstWorkspaceDefinition = workspaceDefinitions[0];

  if (workspaceDefinitions.length <= 1) {
    return firstWorkspaceDefinition;
  }

  const candidatePaths = workspaceDefinitions
    .map(({ workspaceHit }) => workspaceHit.relativePath)
    .filter((relativePath) => !isNodeModulesPath(relativePath));
  const isIgnoredPath = createIgnoredPathMatcher(root, candidatePaths);

  return (
    workspaceDefinitions.find(
      ({ workspaceHit }) =>
        isNodeModulesPath(workspaceHit.relativePath) || !isIgnoredPath(workspaceHit.relativePath),
    ) ?? firstWorkspaceDefinition
  );
}

function collectReferenceLocations(referenceQuery: ReferenceQuery): string[] {
  const { includeTests, program, referenceEntries, root } = referenceQuery;
  const resolveWorkspaceHit = createWorkspaceHitResolver(root, program);
  const workspaceHits = referenceEntries
    .filter((referenceEntry) => includeTests || !isTestFile(referenceEntry.fileName))
    .map((referenceEntry) =>
      resolveWorkspaceHit(referenceEntry.fileName, referenceEntry.textSpan.start),
    )
    .filter((workspaceHit) => workspaceHit !== undefined)
    .filter((workspaceHit) => !isNodeModulesPath(workspaceHit.relativePath));
  const isIgnoredPath = createIgnoredPathMatcher(
    root,
    workspaceHits.map((workspaceHit) => workspaceHit.relativePath),
  );
  const keptLocations = workspaceHits
    .filter((workspaceHit) => !isIgnoredPath(workspaceHit.relativePath))
    .map((workspaceHit) => workspaceHit.location);
  const omittedHits = workspaceHits.filter((workspaceHit) =>
    isIgnoredPath(workspaceHit.relativePath),
  );
  const omittedCount = new Set(omittedHits.map((workspaceHit) => workspaceHit.location)).size;
  const cappedLocations = capLocations([...new Set(keptLocations)]);

  if (omittedCount === 0) {
    return cappedLocations;
  }

  const omittedDirectories = omittedHits.map(
    ({ relativePath }) => findGeneratedOutputDirectory(relativePath) ?? dirname(relativePath),
  );

  return [...cappedLocations, formatOmittedNotice(omittedDirectories, omittedCount)];
}

function createIgnoredPathMatcher(root: string, relativePaths: readonly string[]): IsIgnoredPath {
  const gitCandidatePaths = [...new Set(relativePaths)].filter(
    (relativePath) => findGeneratedOutputDirectory(relativePath) === undefined,
  );
  const gitIgnoredPaths = listGitIgnoredPaths(root, gitCandidatePaths);

  return (relativePath) =>
    findGeneratedOutputDirectory(relativePath) !== undefined || gitIgnoredPaths.has(relativePath);
}

function listGitIgnoredPaths(root: string, relativePaths: readonly string[]): ReadonlySet<string> {
  if (
    relativePaths.length === 0 ||
    isGitUnavailable ||
    !ts.sys.fileExists(join(root, '.gitignore'))
  ) {
    return new Set();
  }

  const checkIgnoreOutput = runGitCheckIgnore(root, relativePaths);

  if (checkIgnoreOutput === undefined) {
    return new Set();
  }

  return new Set(checkIgnoreOutput.split('\0').filter((ignoredPath) => ignoredPath.length > 0));
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

    return undefined;
  }
}

function isNodeModulesPath(relativePath: string): boolean {
  return relativePath.split('/').includes(NODE_MODULES_DIRECTORY_NAME);
}

function isTestFile(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll('\\', '/');

  return TEST_FILE_PATTERN.test(normalizedPath) || normalizedPath.includes('/__tests__/');
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
      return undefined;
    }

    directory = parentDirectory;
  }

  return undefined;
}

function isWorkspaceRootDirectory(directory: string): boolean {
  if (ts.sys.fileExists(join(directory, 'pnpm-workspace.yaml'))) {
    return true;
  }

  return hasPackageJsonWorkspaces(join(directory, 'package.json'));
}

function hasPackageJsonWorkspaces(packageJsonPath: string): boolean {
  const text = ts.sys.readFile(packageJsonPath);

  if (text === undefined) {
    return false;
  }

  try {
    const packageJson: unknown = JSON.parse(text);

    if (!isRecord(packageJson)) {
      return false;
    }

    return packageJson.workspaces !== undefined;
  } catch {
    return false;
  }
}

function toRealPathIfExists(filePath: string): string {
  try {
    return normalizePath(realpathSync(filePath));
  } catch {
    return normalizePath(filePath);
  }
}

function toRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).replaceAll('\\', '/');
}

function normalizePath(filePath: string): string {
  return resolve(filePath).replaceAll('\\', '/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRpcId(value: unknown): JsonRpcId | undefined {
  if (value === null || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function parsePositionInput(rawValue: unknown): PositionInput {
  if (!isRecord(rawValue)) {
    throw new Error('arguments must be an object');
  }

  const file = rawValue.file;
  const line = rawValue.line;
  const character = rawValue.character;
  const includeTests = rawValue.includeTests;

  if (typeof file !== 'string' || file.length === 0) {
    throw new Error('file must be a non-empty string');
  }

  if (typeof line !== 'number' || !Number.isInteger(line) || line < 1) {
    throw new Error('line must be a positive integer');
  }

  if (typeof character !== 'number' || !Number.isInteger(character) || character < 1) {
    throw new Error('character must be a positive integer');
  }

  if (includeTests !== undefined && typeof includeTests !== 'boolean') {
    throw new Error('includeTests must be a boolean');
  }

  return { file, line, character, includeTests };
}

function parseToolName(toolName: string): ToolName {
  if (toolName === TOOL_NAMES.definition || toolName === TOOL_NAMES.references) {
    return toolName;
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

function parseToolCallParams(rawParams: unknown): ToolCallParams {
  if (!isRecord(rawParams)) {
    throw new Error('params must be an object');
  }

  const name = rawParams.name;

  if (typeof name !== 'string') {
    throw new Error('tool name is required');
  }

  return { name, arguments: rawParams.arguments };
}

function parseJsonRpcRequest(value: unknown): JsonRpcRequest | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const method = value.method;

  if (typeof method !== 'string') {
    return undefined;
  }

  return {
    method,
    id: parseJsonRpcId(value.id),
    params: value.params,
  };
}

function listTools() {
  const positionSchema = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'TS/TSX path' },
      line: { type: 'integer', description: '1-based line' },
      character: { type: 'integer', description: '1-based column' },
    },
    required: ['file', 'line', 'character'],
  } as const;

  return [
    {
      name: TOOL_NAMES.definition,
      description: 'Go to definition at file:line:character (1-based).',
      inputSchema: positionSchema,
    },
    {
      name: TOOL_NAMES.references,
      description:
        "Find references at file:line:character. Omits tests (unless includeTests), node_modules, git-ignored files and dist/build/out/coverage. At most 40 locations; extra hits end with a truncated count. Ends with '… omitted N in ignored paths (dirs)' when any were filtered.",
      inputSchema: {
        ...positionSchema,
        properties: {
          ...positionSchema.properties,
          includeTests: { type: 'boolean' },
        },
      },
    },
  ];
}

function callTool(toolName: string, rawArguments: unknown): string {
  const parsedToolName = parseToolName(toolName);
  const positionInput = parsePositionInput(rawArguments);

  switch (parsedToolName) {
    case TOOL_NAMES.definition:
      return formatDefinition(findDefinition(positionInput));
    case TOOL_NAMES.references:
      return findReferences(positionInput).join('\n');
    default: {
      const exhaustiveCheck: never = parsedToolName;

      return exhaustiveCheck;
    }
  }
}

function toJsonRpcPayload(response: JsonRpcResponse): unknown {
  switch (response.kind) {
    case 'result':
      return { jsonrpc: JSON_RPC_VERSION, id: response.id, result: response.result };
    case 'error':
      return { jsonrpc: JSON_RPC_VERSION, id: response.id, error: response.error };
    default: {
      const exhaustiveCheck: never = response;

      return exhaustiveCheck;
    }
  }
}

function dispatchJsonRpcMethod(method: string, id: JsonRpcId, params: unknown): JsonRpcResponse {
  switch (method) {
    case 'initialize':
      scheduleWarmUp();

      return { kind: 'result', id, result: INITIALIZE_RESULT };
    case 'ping':
      return { kind: 'result', id, result: {} };
    case 'tools/list':
      return { kind: 'result', id, result: { tools: listTools() } };
    case 'tools/call': {
      const toolCallParams = parseToolCallParams(params);
      const text = callTool(toolCallParams.name, toolCallParams.arguments);

      return {
        kind: 'result',
        id,
        result: { content: [{ type: 'text', text }] },
      };
    }
    default:
      return {
        kind: 'error',
        id,
        error: { code: JSON_RPC_METHOD_NOT_FOUND, message: `Method not found: ${method}` },
      };
  }
}

function scheduleWarmUp(): void {
  setTimeout(warmUpRootProject, 0);
}

function warmUpRootProject(): void {
  const configPath = normalizePath(join(findWorkspaceRoot(), 'tsconfig.json'));

  if (!ts.sys.fileExists(configPath)) {
    return;
  }

  try {
    refreshProject(configPath);
    getLanguageService(configPath).getProgram()?.getTypeChecker();
  } catch {
    // Best effort: the first lookup reports the same error to the caller.
  }
}

function handleJsonRpcRequest(value: unknown): JsonRpcResponse | undefined {
  const request = parseJsonRpcRequest(value);

  if (request === undefined) {
    return undefined;
  }

  const { method, id, params } = request;

  if (id === undefined || method.startsWith('notifications/') || method === 'initialized') {
    return undefined;
  }

  try {
    return dispatchJsonRpcMethod(method, id, params);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Tool failed';

    if (method === 'tools/call') {
      return {
        kind: 'result',
        id,
        result: {
          content: [{ type: 'text', text: message }],
          isError: true,
        },
      };
    }

    return { kind: 'error', id, error: { code: JSON_RPC_SERVER_ERROR, message } };
  }
}

function writeJsonRpcResponse(value: unknown, isContentLengthFramed: boolean): void {
  const response = handleJsonRpcRequest(value);

  if (response === undefined) {
    return;
  }

  writeJsonRpcMessage(toJsonRpcPayload(response), isContentLengthFramed);
}

async function serveStdin(): Promise<void> {
  let buffer: Buffer = Buffer.alloc(0);
  let isContentLengthSession = false;

  for await (const chunk of Bun.stdin.stream()) {
    buffer = Buffer.concat([buffer, chunk]);
    const drained = drainStdinBuffer(buffer, isContentLengthSession, {
      onInvalid: (message, isContentLengthFramed) => {
        writeJsonRpcMessage(createParseErrorPayload(message), isContentLengthFramed);
      },
      onMessage: (value, isContentLengthFramed) => {
        writeJsonRpcResponse(value, isContentLengthFramed);
      },
    });
    buffer = drained.remaining;
    isContentLengthSession = drained.useContentLength;
  }
}

if (import.meta.main) {
  await serveStdin();
}
