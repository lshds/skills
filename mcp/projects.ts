import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import ts from 'typescript';

import { isPathInsideRoot, LookupError, normalizePath, toRelativePath } from './shared';
import type {
  OpenedProject,
  ProjectGroup,
  ProjectGroupSnapshot,
  ProjectMember,
  ResolutionScope,
  ResolveModuleNames,
} from './types';
import { findWorkspaceManifestDirectory, listWorkspacePackageDirectories } from './workspace';

const TSCONFIG_FILE_NAME = 'tsconfig.json';

const documentRegistry = ts.createDocumentRegistry();
const languageServicesByGroupKey = new Map<string, ts.LanguageService>();
const groupSnapshotsByKey = new Map<string, ProjectGroupSnapshot>();

type ParseConfig = (configPath: string) => ts.ParsedCommandLine | undefined;

/**
 * Opens the TypeScript program that owns a workspace file, synced with disk.
 *
 * When the file's tsconfig sits in a workspace ('pnpm-workspace.yaml' or a 'package.json' with
 * 'workspaces' above it), the program spans every package tsconfig of that workspace, so lookups
 * cross package boundaries. Otherwise it spans the nearest tsconfig and the projects it references.
 * Solution configs (no files, only 'references') are replaced by the projects they reference.
 * Imports in each file resolve with the options of the tsconfig that includes the file.
 *
 * @param fileName - Normalized real path of a file inside 'root'
 * @throws When no tsconfig owns the file, the nearest tsconfig is invalid, or the file is not in the program
 */
export function openProject(root: string, fileName: string): OpenedProject {
  const parseConfig = createConfigParser();
  const group = resolveProjectGroup(root, fileName, parseConfig);

  refreshProjectGroup(group, parseConfig, fileName);

  const service = getLanguageService(group);
  const program = service.getProgram();
  const sourceFile = program ? findSourceFile(program, fileName) : undefined;

  if (!program || !sourceFile) {
    throw new LookupError(
      `File is not in the TypeScript project: ${toRelativePath(root, fileName)}`,
    );
  }

  return { program, service, sourceFile };
}

/**
 * Builds the program and type checker of the workspace root ahead of the first lookup: the
 * workspace's packages when 'root' is a workspace, otherwise the root tsconfig if there is one.
 */
export function warmUpRootProject(root: string): void {
  const parseConfig = createConfigParser();
  const group = resolveRootProjectGroup(root, parseConfig);

  if (!group) {
    return;
  }

  refreshProjectGroup(group, parseConfig);
  getLanguageService(group).getProgram()?.getTypeChecker();
}

function resolveProjectGroup(
  root: string,
  fileName: string,
  parseConfig: ParseConfig,
): ProjectGroup {
  const nearestConfigPath = findNearestConfigPath(root, fileName);
  const ownerConfigPath = findOwnerConfigPath(root, nearestConfigPath, fileName, parseConfig);
  const manifestDirectory = findWorkspaceManifestDirectory(root, dirname(ownerConfigPath));
  const workspaceGroup = manifestDirectory
    ? createWorkspaceGroup(root, manifestDirectory, parseConfig)
    : undefined;

  if (workspaceGroup?.configPaths.includes(ownerConfigPath)) {
    return workspaceGroup;
  }

  return createConfigGroup(root, nearestConfigPath, parseConfig);
}

function resolveRootProjectGroup(
  root: string,
  parseConfig: ParseConfig,
): ProjectGroup | undefined {
  if (findWorkspaceManifestDirectory(root, root) === root) {
    const workspaceGroup = createWorkspaceGroup(root, root, parseConfig);

    if (workspaceGroup.configPaths.length > 0) {
      return workspaceGroup;
    }
  }

  const rootConfigPath = normalizePath(join(root, TSCONFIG_FILE_NAME));

  return ts.sys.fileExists(rootConfigPath)
    ? createConfigGroup(root, rootConfigPath, parseConfig)
    : undefined;
}

function createWorkspaceGroup(
  root: string,
  manifestDirectory: string,
  parseConfig: ParseConfig,
): ProjectGroup {
  const candidateConfigPaths = [
    manifestDirectory,
    ...listWorkspacePackageDirectories(manifestDirectory),
  ]
    .map((directory) => normalizePath(join(directory, TSCONFIG_FILE_NAME)))
    .filter((configPath) => ts.sys.fileExists(configPath));

  return {
    configPaths: expandProjectReferences(root, candidateConfigPaths, parseConfig),
    currentDirectory: manifestDirectory,
    key: `workspace:${manifestDirectory}`,
  };
}

function createConfigGroup(
  root: string,
  configPath: string,
  parseConfig: ParseConfig,
): ProjectGroup {
  const configPaths = expandProjectReferences(root, [configPath], parseConfig);

  return {
    configPaths: configPaths.length > 0 ? configPaths : [configPath],
    currentDirectory: dirname(configPath),
    key: `config:${configPath}`,
  };
}

function findNearestConfigPath(root: string, fileName: string): string {
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists, TSCONFIG_FILE_NAME);

  if (!configPath) {
    throw new LookupError(`No tsconfig.json for ${toRelativePath(root, fileName)}`);
  }

  return normalizePath(configPath);
}

function findOwnerConfigPath(
  root: string,
  nearestConfigPath: string,
  fileName: string,
  parseConfig: ParseConfig,
): string {
  const nearestConfig = readRequiredConfig(nearestConfigPath, parseConfig);

  if (includesFile(nearestConfig, fileName) || !nearestConfig.projectReferences) {
    return nearestConfigPath;
  }

  return (
    expandProjectReferences(root, [nearestConfigPath], parseConfig).find((configPath) =>
      includesFile(parseConfig(configPath), fileName),
    ) ?? nearestConfigPath
  );
}

/**
 * @returns The configs and every project they reference, depth-first. Solution configs are
 * replaced by their references; configs outside 'root' or that cannot be read are skipped.
 */
function expandProjectReferences(
  root: string,
  configPaths: readonly string[],
  parseConfig: ParseConfig,
): string[] {
  const visitedConfigPaths = new Set<string>();
  const expandedConfigPaths: string[] = [];

  const visit = (configPath: string): void => {
    if (visitedConfigPaths.has(configPath) || !isPathInsideRoot(root, configPath)) {
      return;
    }

    visitedConfigPaths.add(configPath);

    const parsedConfig = parseConfig(configPath);

    if (!parsedConfig) {
      return;
    }

    if (parsedConfig.fileNames.length > 0 || !parsedConfig.projectReferences) {
      expandedConfigPaths.push(configPath);
    }

    for (const projectReference of parsedConfig.projectReferences ?? []) {
      visit(normalizePath(ts.resolveProjectReferencePath(projectReference)));
    }
  };

  for (const configPath of configPaths) {
    visit(configPath);
  }

  return expandedConfigPaths;
}

/**
 * @param parsedConfig - 'undefined' for a config that could not be read, which includes nothing
 */
function includesFile(parsedConfig: ts.ParsedCommandLine | undefined, fileName: string): boolean {
  return Boolean(
    parsedConfig?.fileNames.some((configFileName) => normalizePath(configFileName) === fileName),
  );
}

function createConfigParser(): ParseConfig {
  const parsedConfigsByPath = new Map<string, ts.ParsedCommandLine | undefined>();

  return (configPath) => {
    if (!parsedConfigsByPath.has(configPath)) {
      parsedConfigsByPath.set(configPath, readParsedConfig(configPath));
    }

    return parsedConfigsByPath.get(configPath);
  };
}

function readParsedConfig(configPath: string): ts.ParsedCommandLine | undefined {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    return;
  }

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
}

function readRequiredConfig(configPath: string, parseConfig: ParseConfig): ts.ParsedCommandLine {
  const parsedConfig = parseConfig(configPath);

  if (parsedConfig) {
    return parsedConfig;
  }

  const { error } = ts.readConfigFile(configPath, ts.sys.readFile);

  throw new LookupError(
    error
      ? ts.flattenDiagnosticMessageText(error.messageText, '\n')
      : `Cannot read ${configPath}`,
  );
}

function refreshProjectGroup(
  group: ProjectGroup,
  parseConfig: ParseConfig,
  requestedFileName?: string,
): void {
  const previousSnapshot = groupSnapshotsByKey.get(group.key);
  const members = group.configPaths.flatMap((configPath) => {
    const parsedConfig = parseConfig(configPath);

    return parsedConfig ? [toProjectMember(configPath, parsedConfig)] : [];
  });
  const extraFileNames = addExtraFileName(
    previousSnapshot?.extraFileNames ?? new Set<string>(),
    requestedFileName,
  );
  const memberFileNames = members.flatMap((member) => member.fileNames);
  const compilerOptions = createGroupCompilerOptions(members);

  groupSnapshotsByKey.set(group.key, {
    compilerOptions,
    extraFileNames,
    fileNames: [...new Set([...memberFileNames, ...extraFileNames])],
    resolveModuleNames: createModuleResolver(members, compilerOptions, group.currentDirectory),
    version: (previousSnapshot?.version ?? 0) + 1,
  });
}

function toProjectMember(configPath: string, parsedConfig: ts.ParsedCommandLine): ProjectMember {
  return {
    configPath,
    directory: dirname(configPath),
    fileNames: parsedConfig.fileNames.map(normalizePath),
    options: toLookupCompilerOptions(parsedConfig.options),
  };
}

function addExtraFileName(
  extraFileNames: ReadonlySet<string>,
  fileName?: string,
): ReadonlySet<string> {
  if (!fileName || extraFileNames.has(fileName)) {
    return extraFileNames;
  }

  return new Set([...extraFileNames, fileName]);
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

/**
 * One member keeps its own options. Several members share the first member's options, widened so
 * every member's files load: 'paths', 'baseUrl' and 'rootDirs' are dropped because imports
 * resolve per member. Module settings come from a 'node16' or 'nodenext' member when there is
 * one, because only those settings give files the ESM/CJS format their imports resolve with.
 * JSX settings come from the member with the most '.tsx' files.
 */
function createGroupCompilerOptions(members: readonly ProjectMember[]): ts.CompilerOptions {
  const [firstMember] = members;

  if (!firstMember) {
    return {};
  }

  if (members.length === 1) {
    return firstMember.options;
  }

  const moduleMember =
    members.find(({ options }) => usesNodeModuleResolution(options)) ?? firstMember;
  const jsxMember = members.reduce(
    (memberWithMostTsxFiles, member) =>
      countTsxFiles(member) > countTsxFiles(memberWithMostTsxFiles)
        ? member
        : memberWithMostTsxFiles,
    firstMember,
  );

  return {
    ...firstMember.options,
    allowArbitraryExtensions: members.some(({ options }) => options.allowArbitraryExtensions),
    allowJs: members.some(({ options }) => options.allowJs),
    baseUrl: undefined,
    jsx: jsxMember.options.jsx,
    jsxFactory: jsxMember.options.jsxFactory,
    jsxFragmentFactory: jsxMember.options.jsxFragmentFactory,
    jsxImportSource: jsxMember.options.jsxImportSource,
    lib: mergeOptionLists(members, (options) => options.lib),
    module: moduleMember.options.module,
    moduleResolution: moduleMember.options.moduleResolution,
    paths: undefined,
    resolveJsonModule: members.some(({ options }) => options.resolveJsonModule),
    rootDirs: undefined,
    typeRoots: mergeOptionLists(members, (options) => options.typeRoots),
    types: mergeOptionLists(members, (options) => options.types),
  };
}

function usesNodeModuleResolution(options: ts.CompilerOptions): boolean {
  if (options.moduleResolution !== undefined) {
    return (
      options.moduleResolution === ts.ModuleResolutionKind.Node16 ||
      options.moduleResolution === ts.ModuleResolutionKind.NodeNext
    );
  }

  return (
    options.module !== undefined &&
    options.module >= ts.ModuleKind.Node16 &&
    options.module <= ts.ModuleKind.NodeNext
  );
}

function countTsxFiles(member: ProjectMember): number {
  return member.fileNames.filter((fileName) => fileName.endsWith('.tsx')).length;
}

/**
 * @returns The union of every member's list, or 'undefined' when a member leaves it unset (the
 * TypeScript default is the widest choice)
 */
function mergeOptionLists(
  members: readonly ProjectMember[],
  pickList: (options: ts.CompilerOptions) => readonly string[] | undefined,
): string[] | undefined {
  const lists = members.map(({ options }) => pickList(options));
  const definedLists = lists.filter((list): list is readonly string[] => Boolean(list));

  return definedLists.length < lists.length ? undefined : [...new Set(definedLists.flat())];
}

function createModuleResolver(
  members: readonly ProjectMember[],
  compilerOptions: ts.CompilerOptions,
  currentDirectory: string,
): ResolveModuleNames {
  const fallbackScope = createResolutionScope(currentDirectory, compilerOptions, []);
  const deepestFirstScopes = members
    .map((member) => createResolutionScope(member.directory, member.options, member.fileNames))
    .toSorted((left, right) => right.directory.length - left.directory.length);
  const scopesByFileName = new Map<string, ResolutionScope>();

  const findScope = (fileName: string): ResolutionScope => {
    const cachedScope = scopesByFileName.get(fileName);

    if (cachedScope) {
      return cachedScope;
    }

    const scope =
      deepestFirstScopes.find((memberScope) => memberScope.fileNames.has(fileName)) ??
      deepestFirstScopes.find((memberScope) => isPathInsideRoot(memberScope.directory, fileName)) ??
      fallbackScope;
    scopesByFileName.set(fileName, scope);

    return scope;
  };

  return (moduleLiterals, containingFile, redirectedReference, containingSourceFile) => {
    const { cache, options } = findScope(containingFile);

    return moduleLiterals.map((moduleLiteral) =>
      ts.resolveModuleName(
        moduleLiteral.text,
        containingFile,
        options,
        ts.sys,
        cache,
        redirectedReference,
        ts.getModeForUsageLocation(containingSourceFile, moduleLiteral, options),
      ),
    );
  };
}

function createResolutionScope(
  directory: string,
  options: ts.CompilerOptions,
  fileNames: readonly string[],
): ResolutionScope {
  return {
    cache: ts.createModuleResolutionCache(directory, toCanonicalFileName, options),
    directory,
    fileNames: new Set(fileNames),
    options,
  };
}

function toCanonicalFileName(fileName: string): string {
  return ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
}

function getLanguageService(group: ProjectGroup): ts.LanguageService {
  const cachedService = languageServicesByGroupKey.get(group.key);

  if (cachedService) {
    return cachedService;
  }

  const service = createLanguageService(group);
  languageServicesByGroupKey.set(group.key, service);

  return service;
}

function createLanguageService(group: ProjectGroup): ts.LanguageService {
  const readSnapshot = (): ProjectGroupSnapshot => {
    const snapshot = groupSnapshotsByKey.get(group.key);

    if (!snapshot) {
      throw new Error(`Project group was read before it was refreshed: ${group.key}`);
    }

    return snapshot;
  };

  const host: ts.LanguageServiceHost = {
    directoryExists: ts.sys.directoryExists,
    fileExists: ts.sys.fileExists,
    getCompilationSettings: () => readSnapshot().compilerOptions,
    getCurrentDirectory: () => group.currentDirectory,
    getDefaultLibFileName: (compilerOptionsForLib) =>
      ts.getDefaultLibFilePath(compilerOptionsForLib),
    getDirectories: ts.sys.getDirectories,
    getProjectVersion: () => String(readSnapshot().version),
    getScriptFileNames: () => [...readSnapshot().fileNames],
    getScriptSnapshot: (scriptFileName) => {
      const text = ts.sys.readFile(scriptFileName);

      if (text === undefined) {
        return;
      }

      return ts.ScriptSnapshot.fromString(text);
    },
    getScriptVersion: readScriptVersion,
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    realpath: ts.sys.realpath,
    resolveModuleNameLiterals: (
      moduleLiterals,
      containingFile,
      redirectedReference,
      _compilerOptions,
      containingSourceFile,
    ) =>
      readSnapshot().resolveModuleNames(
        moduleLiterals,
        containingFile,
        redirectedReference,
        containingSourceFile,
      ),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  return ts.createLanguageService(host, documentRegistry);
}

function readScriptVersion(fileName: string): string {
  const stats = statSync(fileName, { throwIfNoEntry: false });

  return stats ? `${stats.mtimeMs}:${stats.size}` : '0';
}

function findSourceFile(program: ts.Program, fileName: string): ts.SourceFile | undefined {
  const sourceFile = program.getSourceFile(fileName);

  if (sourceFile) {
    return sourceFile;
  }

  return program
    .getSourceFiles()
    .find((candidate) => normalizePath(candidate.fileName) === fileName);
}
