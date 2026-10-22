import { dirname, resolve } from 'node:path';

import ts from 'typescript';

import {
  createIgnoredPathMatcher,
  findGeneratedOutputDirectory,
  isTestFile,
} from './ignored-paths';
import { describeNoResult, listCandidatePositions } from './position';
import { openProject, warmUpRootProject } from './projects';
import {
  isNodeModulesPath,
  isPathInsideRoot,
  isRecord,
  LookupError,
  normalizePath,
  toRealPathIfExists,
  toRelativePath,
} from './shared';
import { createParseErrorPayload, drainStdinBuffer, writeJsonRpcMessage } from './stdio-rpc';
import type {
  DefinitionHit,
  JsonRpcId,
  JsonRpcMessage,
  JsonRpcResponse,
  OpenedPosition,
  PositionInput,
  ReferenceQuery,
  ResolveWorkspaceHit,
  ToolCallParams,
  ToolName,
  WorkspaceDefinition,
  WorkspaceHit,
} from './types';
import { findWorkspaceRoot } from './workspace';

export { findGeneratedOutputDirectory, isTestFile } from './ignored-paths';
export type { DefinitionHit, PositionInput } from './types';
export { findWorkspaceRoot } from './workspace';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
const [LATEST_PROTOCOL_VERSION] = SUPPORTED_PROTOCOL_VERSIONS;
const JSON_RPC_VERSION = '2.0';
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_SERVER_ERROR = -32000;
const SNIPPET_LINE_COUNT = 8;
const REFERENCE_CAP = 40;
const MAX_OMITTED_DIRECTORIES_SHOWN = 5;
const MAX_ALSO_DEFINED_SHOWN = 5;

const TOOL_NAMES = {
  definition: 'definition',
  references: 'references',
} as const satisfies { readonly [Name in ToolName]: Name };

const SERVER_INFO = { name: 'file-lookup', version: '0.2.0' } as const;

let isWarmUpScheduled = false;

/**
 * Resolves the TypeScript definition of the symbol at a 1-based file position.
 *
 * When several definitions exist, the first one outside ignored paths wins
 * (git-ignored, or under 'dist', 'build', 'out', 'coverage'); the other non-ignored ones are
 * listed in 'otherLocations'. Definitions in 'node_modules' are never treated as ignored.
 *
 * @param positionInput - Workspace-relative TS/TSX 'file', 1-based 'line', and 'symbol' and/or 1-based 'character'
 * @returns A {@link DefinitionHit}: 'path:line' or 'path:start-end' of the declaration and its first lines
 * @throws When the file is outside the workspace, the position is invalid, or no definition exists
 */
export function findDefinition(positionInput: PositionInput): DefinitionHit {
  const openedPosition = openPosition(positionInput);
  const { fileName, program, root, service } = openedPosition;
  const definitionInfos = queryCandidatePositions(
    openedPosition,
    positionInput,
    TOOL_NAMES.definition,
    (position) => service.getDefinitionAtPosition(fileName, position) ?? [],
  );
  const [pickedDefinition, ...otherDefinitions] = orderWorkspaceDefinitions(
    definitionInfos,
    root,
    program,
  );

  if (!pickedDefinition) {
    const [firstDefinitionInfo] = definitionInfos;

    throw new LookupError(`Definition is outside the workspace: ${firstDefinitionInfo.fileName}`);
  }

  return {
    location: pickedDefinition.location,
    otherLocations: otherDefinitions.map(({ location }) => location),
    snippet: readSnippet(pickedDefinition),
  };
}

/**
 * Lists TypeScript reference locations of the symbol at a 1-based file position, across every
 * project the file's program spans (all package tsconfigs in a workspace).
 *
 * Omits 'node_modules', test files unless 'includeTests', and ignored paths:
 * git-ignored files plus anything under 'dist', 'build', 'out' or 'coverage'.
 *
 * @param positionInput - Workspace-relative TS/TSX 'file', 1-based 'line', and 'symbol' and/or 1-based 'character'. Pass 'includeTests' to keep test files.
 * @returns 'path:line,line' per file with at most 40 lines in total, then '… truncated N' when more exist, '… omitted N in tests' and '… omitted N in ignored paths (dirs)' when hits were dropped
 * @throws When the file is outside the workspace, the position is invalid, or no references exist
 */
export function findReferences(positionInput: PositionInput): string[] {
  const openedPosition = openPosition(positionInput);
  const { fileName, program, root, service, sourceFile } = openedPosition;
  const referenceEntries = queryCandidatePositions(
    openedPosition,
    positionInput,
    TOOL_NAMES.references,
    (position) => service.getReferencesAtPosition(fileName, position) ?? [],
  );
  const locations = collectReferenceLines({
    includeTests: positionInput.includeTests ?? false,
    program,
    referenceEntries,
    root,
  });

  if (locations.length === 0) {
    throw new LookupError(
      describeNoResult(
        TOOL_NAMES.references,
        sourceFile,
        positionInput,
        toRelativePath(root, fileName),
      ),
    );
  }

  return locations;
}

export function formatDefinition(definitionHit: DefinitionHit): string {
  return [
    definitionHit.location,
    definitionHit.snippet,
    ...formatAlsoDefinedNotice(definitionHit.otherLocations),
  ].join('\n');
}

/**
 * Groups hits per file as 'path:line,line' in first-hit order, keeping the first 'cap' hits.
 *
 * @param hits - Unique workspace hits
 * @returns One entry per file, then '… truncated N' when N hits were cut
 */
export function formatReferenceLines(
  hits: readonly WorkspaceHit[],
  cap = REFERENCE_CAP,
): string[] {
  const hitsByPath = Map.groupBy(hits.slice(0, cap), (hit) => hit.relativePath);
  const fileEntries = [...hitsByPath].map(
    ([relativePath, fileHits]) =>
      `${relativePath}:${fileHits
        .map(({ line }) => line)
        .toSorted((left, right) => left - right)
        .join(',')}`,
  );

  return hits.length > cap ? [...fileEntries, `… truncated ${hits.length - cap}`] : fileEntries;
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
  const directoryLabels = limitList(
    [...new Set(omittedDirectories)].toSorted(),
    MAX_OMITTED_DIRECTORIES_SHOWN,
  );

  return `… omitted ${omittedCount} in ignored paths (${directoryLabels.join(', ')})`;
}

function openPosition(positionInput: PositionInput): OpenedPosition {
  const root = findWorkspaceRoot();
  const { program, service, sourceFile } = openProject(
    root,
    resolveWorkspaceFile(root, positionInput.file),
  );

  return { fileName: sourceFile.fileName, program, root, service, sourceFile };
}

function queryCandidatePositions<Result>(
  openedPosition: OpenedPosition,
  positionInput: PositionInput,
  toolName: ToolName,
  queryAtPosition: (position: number) => readonly Result[],
): readonly Result[] {
  const { fileName, root, sourceFile } = openedPosition;
  const displayPath = toRelativePath(root, fileName);

  for (const position of listCandidatePositions(sourceFile, positionInput, displayPath)) {
    const results = queryAtPosition(position);

    if (results.length > 0) {
      return results;
    }
  }

  throw new LookupError(describeNoResult(toolName, sourceFile, positionInput, displayPath));
}

function readSourceFile(program: ts.Program, fileName: string): ts.SourceFile {
  return (
    program.getSourceFile(fileName) ??
    ts.createSourceFile(fileName, ts.sys.readFile(fileName) ?? '', ts.ScriptTarget.Latest, false)
  );
}

function resolveWorkspaceFile(root: string, filePath: string): string {
  const absoluteFilePath = normalizePath(resolve(root, filePath));

  if (!isPathInsideRoot(root, absoluteFilePath)) {
    throw new LookupError('Path is outside the workspace');
  }

  const realFilePath = toRealPathIfExists(absoluteFilePath);

  if (!isPathInsideRoot(root, realFilePath)) {
    throw new LookupError('Path is outside the workspace');
  }

  if (!ts.sys.fileExists(realFilePath)) {
    throw new LookupError(`File not found: ${toRelativePath(root, realFilePath)}`);
  }

  return realFilePath;
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

    if (!relativePath) {
      return;
    }

    const { line } = ts.getLineAndCharacterOfPosition(readSourceFile(program, fileName), start);

    return { line: line + 1, relativePath };
  };
}

function toWorkspaceDefinition(
  root: string,
  program: ts.Program,
  definitionInfo: ts.DefinitionInfo,
): WorkspaceDefinition | undefined {
  const realFilePath = toRealPathIfExists(definitionInfo.fileName);

  if (!isPathInsideRoot(root, realFilePath)) {
    return;
  }

  const sourceFile = readSourceFile(program, definitionInfo.fileName);
  const relativePath = toRelativePath(root, realFilePath);
  const { contextSpan, textSpan } = definitionInfo;
  const startLine = sourceFile.getLineAndCharacterOfPosition((contextSpan ?? textSpan).start).line;
  const endLine = contextSpan
    ? sourceFile.getLineAndCharacterOfPosition(contextSpan.start + contextSpan.length).line
    : startLine + SNIPPET_LINE_COUNT - 1;
  const location =
    contextSpan && endLine !== startLine
      ? `${relativePath}:${startLine + 1}-${endLine + 1}`
      : `${relativePath}:${startLine + 1}`;

  return { endLine, location, relativePath, sourceFile, startLine };
}

function readSnippet({ endLine, sourceFile, startLine }: WorkspaceDefinition): string {
  const lastLine = Math.min(endLine, startLine + SNIPPET_LINE_COUNT - 1);
  const lineStarts = sourceFile.getLineStarts();
  const snippetStart = lineStarts[startLine] ?? 0;
  const snippetEnd = lineStarts[lastLine + 1] ?? sourceFile.text.length;

  return sourceFile.text
    .slice(snippetStart, snippetEnd)
    .split(/\r?\n/)
    .slice(0, lastLine - startLine + 1)
    .join('\n');
}

/**
 * @returns Workspace definitions without duplicates, the first one outside ignored paths first,
 * followed by the other non-ignored ones; only the first definition when all are ignored
 */
function orderWorkspaceDefinitions(
  definitionInfos: readonly ts.DefinitionInfo[],
  root: string,
  program: ts.Program,
): WorkspaceDefinition[] {
  const workspaceDefinitions = dedupeBy(
    definitionInfos.flatMap((definitionInfo) => {
      const workspaceDefinition = toWorkspaceDefinition(root, program, definitionInfo);

      return workspaceDefinition ? [workspaceDefinition] : [];
    }),
    ({ location }) => location,
  );

  if (workspaceDefinitions.length <= 1) {
    return workspaceDefinitions;
  }

  const isIgnoredPath = createIgnoredPathMatcher(
    root,
    workspaceDefinitions
      .map(({ relativePath }) => relativePath)
      .filter((relativePath) => !isNodeModulesPath(relativePath)),
  );
  const keptDefinitions = workspaceDefinitions.filter(
    ({ relativePath }) => isNodeModulesPath(relativePath) || !isIgnoredPath(relativePath),
  );

  return keptDefinitions.length > 0 ? keptDefinitions : workspaceDefinitions.slice(0, 1);
}

function collectReferenceLines(referenceQuery: ReferenceQuery): string[] {
  const { includeTests, program, referenceEntries, root } = referenceQuery;
  const resolveWorkspaceHit = createWorkspaceHitResolver(root, program);
  const workspaceHits = dedupeBy(
    referenceEntries.flatMap((referenceEntry) => {
      const workspaceHit = resolveWorkspaceHit(
        referenceEntry.fileName,
        referenceEntry.textSpan.start,
      );

      return workspaceHit && !isNodeModulesPath(workspaceHit.relativePath) ? [workspaceHit] : [];
    }),
    ({ line, relativePath }) => `${relativePath}:${line}`,
  );
  const isOmittedTestHit = ({ relativePath }: WorkspaceHit) =>
    !includeTests && isTestFile(relativePath);
  const sourceHits = workspaceHits.filter((workspaceHit) => !isOmittedTestHit(workspaceHit));
  const isIgnoredPath = createIgnoredPathMatcher(
    root,
    sourceHits.map(({ relativePath }) => relativePath),
  );

  return [
    ...formatReferenceLines(sourceHits.filter(({ relativePath }) => !isIgnoredPath(relativePath))),
    ...formatOmittedTestsNotice(workspaceHits.filter(isOmittedTestHit)),
    ...formatOmittedIgnoredNotice(
      sourceHits.filter(({ relativePath }) => isIgnoredPath(relativePath)),
    ),
  ];
}

function formatOmittedTestsNotice(testHits: readonly WorkspaceHit[]): string[] {
  return testHits.length > 0 ? [`… omitted ${testHits.length} in tests`] : [];
}

function formatOmittedIgnoredNotice(ignoredHits: readonly WorkspaceHit[]): string[] {
  if (ignoredHits.length === 0) {
    return [];
  }

  const ignoredDirectories = ignoredHits.map(
    ({ relativePath }) => findGeneratedOutputDirectory(relativePath) ?? dirname(relativePath),
  );

  return [formatOmittedNotice(ignoredDirectories, ignoredHits.length)];
}

function formatAlsoDefinedNotice(locations: readonly string[]): string[] {
  return locations.length > 0
    ? [`… also defined at ${limitList(locations, MAX_ALSO_DEFINED_SHOWN).join(', ')}`]
    : [];
}

function limitList(items: readonly string[], maxShownCount: number): string[] {
  const shownItems = items.slice(0, maxShownCount);
  const hiddenCount = items.length - shownItems.length;

  return hiddenCount > 0 ? [...shownItems, `+${hiddenCount} more`] : shownItems;
}

function dedupeBy<Item>(items: readonly Item[], toKey: (item: Item) => string): Item[] {
  const seenKeys = new Set<string>();

  return items.filter((item) => {
    const key = toKey(item);

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);

    return true;
  });
}

function parseJsonRpcId(value: unknown): JsonRpcId | undefined {
  if (value === null || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function parsePositionInput(rawValue: unknown): PositionInput {
  if (!isRecord(rawValue)) {
    throw new LookupError('arguments must be an object');
  }

  const { file, line } = rawValue;
  const character = rawValue.character ?? undefined;
  const symbol = rawValue.symbol ?? undefined;
  const includeTests = rawValue.includeTests ?? undefined;

  if (typeof file !== 'string' || !file) {
    throw new LookupError('file must be a non-empty string');
  }

  if (!isPositiveInteger(line)) {
    throw new LookupError('line must be a positive integer');
  }

  if (character !== undefined && !isPositiveInteger(character)) {
    throw new LookupError('character must be a positive integer');
  }

  if (symbol !== undefined && (typeof symbol !== 'string' || !symbol.trim())) {
    throw new LookupError('symbol must be a non-empty string');
  }

  if (includeTests !== undefined && typeof includeTests !== 'boolean') {
    throw new LookupError('includeTests must be a boolean');
  }

  return { file, line, character, symbol, includeTests };
}

function parseToolName(toolName: string): ToolName {
  if (toolName === TOOL_NAMES.definition || toolName === TOOL_NAMES.references) {
    return toolName;
  }

  throw new LookupError(`Unknown tool: ${toolName}`);
}

function parseToolCallParams(rawParams: unknown): ToolCallParams {
  if (!isRecord(rawParams)) {
    throw new LookupError('params must be an object');
  }

  const name = rawParams.name;

  if (typeof name !== 'string') {
    throw new LookupError('tool name is required');
  }

  return { name, arguments: rawParams.arguments };
}

/**
 * Classifies one decoded JSON-RPC value. Notifications and responses are ignored; a value that
 * is neither, or a request with an id that is not a string, number or null, is invalid.
 */
function parseJsonRpcMessage(value: unknown): JsonRpcMessage {
  if (!isRecord(value)) {
    return { kind: 'invalid', id: null };
  }

  const { method } = value;
  const id = parseJsonRpcId(value.id);

  if (typeof method !== 'string') {
    return 'result' in value || 'error' in value
      ? { kind: 'ignored' }
      : { kind: 'invalid', id: id ?? null };
  }

  if (!('id' in value) || method.startsWith('notifications/') || method === 'initialized') {
    return { kind: 'ignored' };
  }

  return id === undefined
    ? { kind: 'invalid', id: null }
    : { kind: 'request', id, method, params: value.params };
}

function negotiateProtocolVersion(params: unknown): string {
  if (!isRecord(params)) {
    return LATEST_PROTOCOL_VERSION;
  }

  return (
    SUPPORTED_PROTOCOL_VERSIONS.find((version) => version === params.protocolVersion) ??
    LATEST_PROTOCOL_VERSION
  );
}

function listTools() {
  const positionSchema = {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'TS/TSX path' },
      line: { type: 'integer', description: '1-based line' },
      symbol: { type: 'string', description: 'Identifier on that line' },
      character: { type: 'integer', description: '1-based column; omit when symbol is set' },
    },
    required: ['file', 'line'],
  } as const;
  const readOnlyAnnotations = { readOnlyHint: true, openWorldHint: false } as const;

  return [
    {
      name: TOOL_NAMES.definition,
      description: 'Definition of the symbol at file:line, with its first lines.',
      inputSchema: positionSchema,
      annotations: readOnlyAnnotations,
    },
    {
      name: TOOL_NAMES.references,
      description:
        'References to the symbol at file:line across the workspace. Omits tests unless includeTests, node_modules, git-ignored and build output.',
      inputSchema: {
        ...positionSchema,
        properties: {
          ...positionSchema.properties,
          includeTests: { type: 'boolean' },
        },
      },
      annotations: readOnlyAnnotations,
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
      return {
        kind: 'result',
        id,
        result: {
          protocolVersion: negotiateProtocolVersion(params),
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    case 'ping':
      return { kind: 'result', id, result: {} };
    case 'tools/list':
      scheduleWarmUp();

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
  if (isWarmUpScheduled) {
    return;
  }

  isWarmUpScheduled = true;
  setTimeout(runWarmUp, 0);
}

function runWarmUp(): void {
  try {
    warmUpRootProject(findWorkspaceRoot());
  } catch (caught) {
    // Best effort: the first lookup reports the same error to the caller.
    if (!(caught instanceof LookupError)) {
      logInternalError(caught);
    }
  }
}

function logInternalError(caught: unknown): void {
  console.error('[file-lookup]', caught);
}

function handleJsonRpcRequest(value: unknown): JsonRpcResponse | undefined {
  const jsonRpcMessage = parseJsonRpcMessage(value);

  switch (jsonRpcMessage.kind) {
    case 'ignored':
      return;
    case 'invalid':
      return {
        kind: 'error',
        id: jsonRpcMessage.id,
        error: { code: JSON_RPC_INVALID_REQUEST, message: 'Invalid Request' },
      };
    case 'request':
      return respondToJsonRpcRequest(
        jsonRpcMessage.method,
        jsonRpcMessage.id,
        jsonRpcMessage.params,
      );
    default: {
      const exhaustiveCheck: never = jsonRpcMessage;

      return exhaustiveCheck;
    }
  }
}

function respondToJsonRpcRequest(
  method: string,
  id: JsonRpcId,
  params: unknown,
): JsonRpcResponse {
  try {
    return dispatchJsonRpcMethod(method, id, params);
  } catch (caught) {
    if (!(caught instanceof LookupError)) {
      logInternalError(caught);
    }

    const errorMessage = caught instanceof Error ? caught.message : 'Tool failed';

    if (method === 'tools/call') {
      return {
        kind: 'result',
        id,
        result: {
          content: [{ type: 'text', text: errorMessage }],
          isError: true,
        },
      };
    }

    return { kind: 'error', id, error: { code: JSON_RPC_SERVER_ERROR, message: errorMessage } };
  }
}

function writeJsonRpcResponse(value: unknown, isContentLengthFramed: boolean): void {
  const response = handleJsonRpcRequest(value);

  if (!response) {
    return;
  }

  writeJsonRpcMessage(toJsonRpcPayload(response), isContentLengthFramed);
}

async function serveStdin(): Promise<void> {
  let buffer: Buffer = Buffer.alloc(0);
  let isContentLengthSession = false;

  for await (const chunk of Bun.stdin.stream()) {
    buffer = Buffer.concat([buffer, chunk]);
    const drainResult = drainStdinBuffer(buffer, isContentLengthSession, {
      onInvalid: (message, isContentLengthFramed) => {
        writeJsonRpcMessage(createParseErrorPayload(message), isContentLengthFramed);
      },
      onMessage: (value, isContentLengthFramed) => {
        writeJsonRpcResponse(value, isContentLengthFramed);
      },
    });
    buffer = drainResult.remaining;
    isContentLengthSession = drainResult.isContentLengthSession;
  }
}

if (import.meta.main) {
  await serveStdin();
}
