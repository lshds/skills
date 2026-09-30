import type ts from 'typescript';

export type JsonRpcId = string | number | null;
export type ToolName = 'definition' | 'references';
export type ResolveWorkspaceHit = (fileName: string, start: number) => WorkspaceHit | undefined;
export type IsIgnoredPath = (relativePath: string) => boolean;

export type JsonRpcResponse =
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

export interface ProjectSnapshot {
  readonly compilerOptions: ts.CompilerOptions;
  readonly configMtimeMs: number;
  readonly extraFileNames: ReadonlySet<string>;
  readonly fileNames: readonly string[];
  readonly version: number;
}

export interface OpenedPosition {
  fileName: string;
  position: number;
  program: ts.Program;
  root: string;
  service: ts.LanguageService;
}

export interface WorkspaceHit {
  location: string;
  relativePath: string;
}

export interface WorkspaceDefinition {
  definitionInfo: ts.DefinitionInfo;
  workspaceHit: WorkspaceHit;
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

export interface JsonRpcRequest {
  method: string;
  id: JsonRpcId | undefined;
  params: unknown;
}

export interface ToolCallParams {
  name: string;
  arguments: unknown;
}
