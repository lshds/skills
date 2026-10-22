import type ts from 'typescript';

export type JsonRpcId = string | number | null;
export type ToolName = 'definition' | 'references';
export type ResolveWorkspaceHit = (fileName: string, start: number) => WorkspaceHit | undefined;
export type IsIgnoredPath = (relativePath: string) => boolean;
export type ResolveModuleNames = (
  moduleLiterals: readonly ts.StringLiteralLike[],
  containingFile: string,
  redirectedReference: ts.ResolvedProjectReference | undefined,
  containingSourceFile: ts.SourceFile,
) => readonly ts.ResolvedModuleWithFailedLookupLocations[];

export type JsonRpcResponse =
  | { kind: 'result'; id: JsonRpcId; result: unknown }
  | { kind: 'error'; id: JsonRpcId; error: JsonRpcErrorBody };

export type JsonRpcMessage =
  | { kind: 'request'; id: JsonRpcId; method: string; params: unknown }
  | { kind: 'invalid'; id: JsonRpcId }
  | { kind: 'ignored' };

export interface PositionInput {
  file: string;
  line: number;
  character?: number;
  symbol?: string;
  includeTests?: boolean;
}

export interface DefinitionHit {
  location: string;
  otherLocations: readonly string[];
  snippet: string;
}

export interface ProjectMember {
  readonly configPath: string;
  readonly directory: string;
  readonly fileNames: readonly string[];
  readonly options: ts.CompilerOptions;
}

export interface ProjectGroup {
  readonly configPaths: readonly string[];
  readonly currentDirectory: string;
  readonly key: string;
}

export interface ProjectGroupSnapshot {
  readonly compilerOptions: ts.CompilerOptions;
  readonly extraFileNames: ReadonlySet<string>;
  readonly fileNames: readonly string[];
  readonly resolveModuleNames: ResolveModuleNames;
  readonly version: number;
}

export interface ResolutionScope {
  readonly cache: ts.ModuleResolutionCache;
  readonly directory: string;
  readonly fileNames: ReadonlySet<string>;
  readonly options: ts.CompilerOptions;
}

export interface OpenedProject {
  program: ts.Program;
  service: ts.LanguageService;
  sourceFile: ts.SourceFile;
}

export interface OpenedPosition extends OpenedProject {
  fileName: string;
  root: string;
}

export interface LineSpan {
  end: number;
  start: number;
}

export interface LineIdentifier {
  end: number;
  start: number;
  text: string;
}

export interface WorkspaceHit {
  line: number;
  relativePath: string;
}

export interface WorkspaceDefinition {
  endLine: number;
  location: string;
  relativePath: string;
  sourceFile: ts.SourceFile;
  startLine: number;
}

export interface ReferenceQuery {
  includeTests: boolean;
  program: ts.Program;
  referenceEntries: readonly ts.ReferenceEntry[];
  root: string;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
}

export interface ToolCallParams {
  name: string;
  arguments: unknown;
}
