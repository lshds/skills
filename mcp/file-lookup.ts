import { realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';

import { createParseErrorPayload, drainStdinBuffer, writeJsonRpcMessage } from './stdio-rpc';

const PROTOCOL_VERSION = '2024-11-05';
const JSON_RPC_VERSION = '2.0';
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_SERVER_ERROR = -32000;
const SNIPPET_LINE_COUNT = 8;
const REFERENCE_CAP = 40;
const MAX_WORKSPACE_ROOT_WALK_DEPTH = 8;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

const TOOL_NAMES = {
  definition: 'definition',
  references: 'references',
} as const;

const INITIALIZE_RESULT = {
  protocolVersion: PROTOCOL_VERSION,
  capabilities: { tools: {} },
  serverInfo: { name: 'file-lookup', version: '0.1.0' },
} as const;

const languageServicesByConfigPath = new Map<string, CachedLanguageService>();

type JsonRpcId = string | number | null;
type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

type JsonRpcResponse =
  | { kind: 'result'; id: JsonRpcId; result: unknown }
  | { kind: 'error'; id: JsonRpcId; error: JsonRpcErrorBody };

export interface PositionInput {
  file: string;
  line: number;
  character: number;
  includeTests?: boolean;
}

export interface DefinitionHit {
  location: string;
  snippet: string;
}

interface CachedLanguageService {
  extraFileNames: Set<string>;
  service: ts.LanguageService;
}

interface OpenedPosition {
  fileName: string;
  position: number;
  root: string;
  service: ts.LanguageService;
}

interface JsonRpcErrorBody {
  code: number;
  message: string;
}

interface JsonRpcRequest {
  method: string;
  id: JsonRpcId | undefined;
  params: unknown;
}

interface ReferenceLocationQuery {
  root: string;
  includeTests: boolean;
  fileName: string;
  start: number;
  seenLocations: Set<string>;
}

/**
 * Walks up from cwd, then this module, looking for a workspace root.
 *
 * A root is a directory with `pnpm-workspace.yaml` or a `package.json` that
 * declares `workspaces` (npm, yarn, bun). A nested `package.json` without
 * `workspaces` is not a root.
 *
 * @returns The real path of that directory, or the real path of `process.cwd()` if none is found
 */
export function findWorkspaceRoot(): string {
  const markedDirectory =
    walkToWorkspaceMarker(process.cwd()) ?? walkToWorkspaceMarker(import.meta.dir);
  const directory = markedDirectory ?? process.cwd();

  try {
    return toRealPath(directory);
  } catch {
    return normalizePath(directory);
  }
}

/**
 * Resolves the TypeScript definition at a 1-based file position.
 *
 * @param positionInput - Workspace-relative TS/TSX 'file' with 1-based 'line' and 'character'
 * @returns A {@link DefinitionHit} with a 'path:line' location and a nearby source snippet
 * @throws When the file is outside the workspace, the position is invalid, or no definition exists
 */
export function findDefinition(positionInput: PositionInput): DefinitionHit {
  const { fileName, position, root, service } = openPosition(positionInput);
  const definitionInfos = service.getDefinitionAtPosition(fileName, position) ?? [];
  const firstDefinition = definitionInfos[0];

  if (firstDefinition === undefined) {
    throw new Error(
      `No definition at ${positionInput.file}:${positionInput.line}:${positionInput.character}`,
    );
  }

  const location = formatWorkspaceLocation(
    root,
    firstDefinition.fileName,
    firstDefinition.textSpan.start,
  );

  if (location === undefined) {
    throw new Error(`Definition is outside the workspace: ${firstDefinition.fileName}`);
  }

  return {
    location,
    snippet: readSnippet(firstDefinition.fileName, firstDefinition.textSpan.start),
  };
}

/**
 * Lists TypeScript reference locations at a 1-based file position.
 *
 * @param positionInput - Workspace-relative TS/TSX 'file' with 1-based 'line' and 'character'. Pass 'includeTests' to keep test files.
 * @returns Workspace-relative 'path:line' strings, at most 40 entries, plus a truncation notice when more exist
 * @throws When the file is outside the workspace, the position is invalid, or no references exist
 */
export function findReferences(positionInput: PositionInput): string[] {
  const { fileName, position, root, service } = openPosition(positionInput);
  const referenceEntries = service.getReferencesAtPosition(fileName, position) ?? [];
  const includeTests = positionInput.includeTests ?? false;
  const locations = collectReferenceLocations(referenceEntries, root, includeTests);

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
 * Keeps the first `cap` locations and appends a truncation notice when more exist.
 *
 * @param locations - Workspace-relative 'path:line' strings
 * @param cap - Maximum locations to keep
 * @returns At most `cap` locations, plus '… truncated N' when N locations were omitted
 */
export function capLocations(locations: readonly string[], cap = REFERENCE_CAP): string[] {
  if (locations.length <= cap) {
    return [...locations];
  }

  return [...locations.slice(0, cap), `… truncated ${locations.length - cap}`];
}

function openPosition(positionInput: PositionInput): OpenedPosition {
  const root = findWorkspaceRoot();
  const absolutePath = resolveWorkspaceFile(root, positionInput.file);
  const service = getLanguageService(absolutePath);
  const sourceFile = findSourceFile(service, absolutePath);

  if (sourceFile === undefined) {
    throw new Error(`File is not in the TypeScript project: ${toRelativePath(root, absolutePath)}`);
  }

  const fileName = sourceFile.fileName;
  const lineIndex = positionInput.line - 1;
  const characterIndex = positionInput.character - 1;

  if (lineIndex < 0 || characterIndex < 0) {
    throw new Error('line and character are 1-based');
  }

  let position: number;

  try {
    position = ts.getPositionOfLineAndCharacter(sourceFile, lineIndex, characterIndex);
  } catch {
    throw new Error(
      `Position ${positionInput.line}:${positionInput.character} is out of range in ${toRelativePath(root, fileName)}`,
    );
  }

  return { fileName, position, root, service };
}

function findSourceFile(
  languageService: ts.LanguageService,
  fileName: string,
): ts.SourceFile | undefined {
  const program = languageService.getProgram();

  if (program === undefined) {
    return undefined;
  }

  const sourceFile = program.getSourceFile(fileName);

  if (sourceFile !== undefined) {
    return sourceFile;
  }

  const normalizedFileName = normalizePath(fileName);

  return program
    .getSourceFiles()
    .find((candidate) => normalizePath(candidate.fileName) === normalizedFileName);
}

function getLanguageService(fileName: string): ts.LanguageService {
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists, 'tsconfig.json');

  if (configPath === undefined) {
    throw new Error(`No tsconfig.json for ${fileName}`);
  }

  const cachedService = languageServicesByConfigPath.get(configPath);

  if (cachedService !== undefined) {
    cachedService.extraFileNames.add(fileName);
    return cachedService.service;
  }

  const extraFileNames = new Set<string>([fileName]);
  const service = createLanguageService(configPath, extraFileNames);
  languageServicesByConfigPath.set(configPath, { extraFileNames, service });

  return service;
}

function createLanguageService(
  configPath: string,
  extraFileNames: Set<string>,
): ts.LanguageService {
  const configDirectory = dirname(configPath);
  const compilerOptions = readCompilerOptions(configPath, configDirectory);

  const host: ts.LanguageServiceHost = {
    directoryExists: ts.sys.directoryExists,
    fileExists: ts.sys.fileExists,
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => configDirectory,
    getDefaultLibFileName: (compilerOptionsForLib) =>
      ts.getDefaultLibFilePath(compilerOptionsForLib),
    getDirectories: ts.sys.getDirectories,
    getProjectVersion: () => {
      const fileNames = readProjectFileNames(configPath, extraFileNames);
      return readProjectVersion(configPath, fileNames);
    },
    getScriptFileNames: () => readProjectFileNames(configPath, extraFileNames),
    getScriptSnapshot: (scriptFileName) => {
      const text = ts.sys.readFile(scriptFileName);

      if (text === undefined) {
        return undefined;
      }

      return ts.ScriptSnapshot.fromString(text);
    },
    getScriptVersion: (scriptFileName) => {
      try {
        return String(statSync(scriptFileName).mtimeMs);
      } catch {
        return '0';
      }
    },
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

function readCompilerOptions(configPath: string, configDirectory: string): ts.CompilerOptions {
  const configFileRead = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFileRead.error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(configFileRead.error.messageText, '\n'));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFileRead.config,
    ts.sys,
    configDirectory,
  );

  return {
    ...parsedConfig.options,
    baseUrl: parsedConfig.options.baseUrl ?? configDirectory,
    composite: false,
    incremental: false,
    plugins: [],
    tsBuildInfoFile: undefined,
  };
}

function readProjectFileNames(configPath: string, extraFileNames: ReadonlySet<string>): string[] {
  const configFileRead = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFileRead.config ?? {},
    ts.sys,
    dirname(configPath),
  );
  const fileNames = new Set(parsedConfig.fileNames.map(normalizePath));

  for (const extraFileName of extraFileNames) {
    fileNames.add(extraFileName);
  }

  return [...fileNames];
}

function readProjectVersion(configPath: string, fileNames: readonly string[]): string {
  let configMtime = 0;

  try {
    configMtime = statSync(configPath).mtimeMs;
  } catch {
    configMtime = 0;
  }

  return `${configMtime}:${fileNames.length}:${fileNames.join('\0')}`;
}

function resolveWorkspaceFile(root: string, file: string): string {
  const rootRealPath = toRealPath(root);
  const absolutePath = normalizePath(resolve(root, file));

  if (!isPathInsideRoot(rootRealPath, absolutePath)) {
    throw new Error('Path is outside the workspace');
  }

  let realFilePath = absolutePath;

  try {
    realFilePath = toRealPath(absolutePath);
  } catch {
    realFilePath = absolutePath;
  }

  if (!isPathInsideRoot(rootRealPath, realFilePath)) {
    throw new Error('Path is outside the workspace');
  }

  if (!ts.sys.fileExists(realFilePath)) {
    throw new Error(`File not found: ${toRelativePath(rootRealPath, realFilePath)}`);
  }

  return realFilePath;
}

function isPathInsideRoot(root: string, file: string): boolean {
  const relativePath = relative(root, file).replaceAll('\\', '/');

  return relativePath !== '..' && !relativePath.startsWith('../');
}

function formatWorkspaceLocation(root: string, absFile: string, start: number): string | undefined {
  const normalizedPath = toRealPathIfExists(absFile);

  if (!isPathInsideRoot(root, normalizedPath)) {
    return undefined;
  }

  const sourceFile = ts.createSourceFile(
    normalizedPath,
    ts.sys.readFile(normalizedPath) ?? '',
    ts.ScriptTarget.Latest,
    true,
  );
  const { line } = ts.getLineAndCharacterOfPosition(sourceFile, start);

  return `${toRelativePath(root, normalizedPath)}:${line + 1}`;
}

function readSnippet(absFile: string, start: number): string {
  const text = ts.sys.readFile(absFile) ?? '';
  const sourceFile = ts.createSourceFile(absFile, text, ts.ScriptTarget.Latest, true);
  const { line } = ts.getLineAndCharacterOfPosition(sourceFile, start);
  const lines = text.split(/\r?\n/);
  const startLine = Math.max(0, line);
  const endLine = Math.min(lines.length, startLine + SNIPPET_LINE_COUNT);

  return lines.slice(startLine, endLine).join('\n');
}

function collectReferenceLocations(
  referenceEntries: readonly ts.ReferenceEntry[],
  root: string,
  includeTests: boolean,
): string[] {
  const seenLocations = new Set<string>();
  const locations: string[] = [];

  for (const referenceEntry of referenceEntries) {
    const location = resolveReferenceLocation({
      root,
      includeTests,
      fileName: referenceEntry.fileName,
      start: referenceEntry.textSpan.start,
      seenLocations,
    });

    if (location !== undefined) {
      locations.push(location);
    }
  }

  return capLocations(locations);
}

function resolveReferenceLocation(query: ReferenceLocationQuery): string | undefined {
  if (!query.includeTests && isTestFile(query.fileName)) {
    return undefined;
  }

  const location = formatWorkspaceLocation(query.root, query.fileName, query.start);

  if (location === undefined || query.seenLocations.has(location)) {
    return undefined;
  }

  query.seenLocations.add(location);

  return location;
}

function isTestFile(file: string): boolean {
  const normalizedPath = file.replaceAll('\\', '/');

  return TEST_FILE_PATTERN.test(normalizedPath) || normalizedPath.includes('/__tests__/');
}

function walkToWorkspaceMarker(startDirectory: string): string | undefined {
  let directory = startDirectory;

  for (let depth = 0; depth < MAX_WORKSPACE_ROOT_WALK_DEPTH; depth += 1) {
    if (directoryIsWorkspaceRoot(directory)) {
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

function directoryIsWorkspaceRoot(directory: string): boolean {
  if (ts.sys.fileExists(join(directory, 'pnpm-workspace.yaml'))) {
    return true;
  }

  return packageJsonDeclaresWorkspaces(join(directory, 'package.json'));
}

function packageJsonDeclaresWorkspaces(packageJsonPath: string): boolean {
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

function toRealPath(path: string): string {
  return normalizePath(realpathSync(path));
}

function toRealPathIfExists(path: string): string {
  try {
    return toRealPath(path);
  } catch {
    return normalizePath(path);
  }
}

function toRelativePath(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/');
}

function normalizePath(file: string): string {
  return resolve(file).replaceAll('\\', '/');
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

function parseToolCallParams(rawParams: unknown): { name: string; arguments: unknown } {
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
        'Find references at file:line:character. Omits tests unless includeTests. At most 40 locations; extra hits end with a truncated count.',
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
  const positionInput = parsePositionInput(rawArguments);
  const parsedToolName = parseToolName(toolName);

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

function writeJsonRpcResponse(value: unknown, contentLength: boolean): void {
  const response = handleJsonRpcRequest(value);

  if (response === undefined) {
    return;
  }

  writeJsonRpcMessage(toJsonRpcPayload(response), contentLength);
}

async function serveStdin(): Promise<void> {
  let buffer: Buffer = Buffer.alloc(0);
  let useContentLength = false;

  for await (const chunk of Bun.stdin.stream()) {
    buffer = Buffer.from(Buffer.concat([buffer, Buffer.from(chunk)]));
    const drained = drainStdinBuffer(buffer, useContentLength, {
      onInvalid: (message, contentLength) => {
        writeJsonRpcMessage(createParseErrorPayload(message), contentLength);
      },
      onMessage: (value, contentLength) => {
        writeJsonRpcResponse(value, contentLength);
      },
    });
    buffer = Buffer.from(drained.remaining);
    useContentLength = drained.useContentLength;
  }
}

if (import.meta.main) {
  await serveStdin();
}
