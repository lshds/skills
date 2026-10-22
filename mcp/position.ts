import ts from 'typescript';

import { LookupError } from './shared';
import type { LineIdentifier, LineSpan, PositionInput, ToolName } from './types';

const MAX_SUGGESTED_IDENTIFIERS = 8;
const MAX_SUGGESTED_LINES = 5;

/**
 * Lists the positions to query for a 1-based 'line' plus a 'symbol' and/or 1-based 'character'.
 *
 * With 'symbol' ('a.b' and 'b()' mean 'b'): each occurrence of that identifier on the line,
 * nearest to 'character' first. Without it: the exact column, then the line's only identifier
 * when there is exactly one. Comments and strings never match.
 *
 * @param displayPath - Workspace-relative path for error messages
 * @returns Positions to try in order; empty when the column is past the end of the line
 * @throws When the line is out of range, 'symbol' is not on the line, or neither 'symbol' nor 'character' is given
 */
export function listCandidatePositions(
  sourceFile: ts.SourceFile,
  positionInput: PositionInput,
  displayPath: string,
): number[] {
  const { character, line, symbol } = positionInput;
  const lineSpan = readLineSpan(sourceFile, line, displayPath);
  const lineIdentifiers = listLineIdentifiers(sourceFile, lineSpan);

  if (symbol) {
    const symbolName = toIdentifierName(symbol);
    const matchingIdentifiers = lineIdentifiers.filter(({ text }) => text === symbolName);

    if (matchingIdentifiers.length === 0) {
      throw new LookupError(describeMissingSymbol(sourceFile, symbolName, line, displayPath));
    }

    if (character === undefined) {
      return matchingIdentifiers.map(({ start }) => start);
    }

    const characterPosition = lineSpan.start + character - 1;
    const measureDistance = ({ start }: LineIdentifier) => Math.abs(start - characterPosition);

    return matchingIdentifiers
      .toSorted((left, right) => measureDistance(left) - measureDistance(right))
      .map(({ start }) => start);
  }

  if (character === undefined) {
    throw new LookupError('Pass symbol (the identifier name) or character');
  }

  return listColumnPositions(lineSpan.start + character - 1, lineSpan, lineIdentifiers);
}

/**
 * @returns 'No <tool> for <symbol> at path:line', or 'No <tool> at path:line:character' followed
 * by the identifiers on that line to pass as 'symbol'
 */
export function describeNoResult(
  toolName: ToolName,
  sourceFile: ts.SourceFile,
  positionInput: PositionInput,
  displayPath: string,
): string {
  const { character, line, symbol } = positionInput;

  if (symbol) {
    return `No ${toolName} for ${toIdentifierName(symbol)} at ${displayPath}:${line}`;
  }

  const lineSpan = readLineSpan(sourceFile, line, displayPath);
  const identifierNames = [
    ...new Set(listLineIdentifiers(sourceFile, lineSpan).map(({ text }) => text)),
  ].slice(0, MAX_SUGGESTED_IDENTIFIERS);
  const message = `No ${toolName} at ${displayPath}:${line}:${character}`;

  if (identifierNames.length === 0) {
    return message;
  }

  return `${message}. Pass symbol, one of: ${identifierNames.join(', ')}`;
}

function listColumnPositions(
  characterPosition: number,
  lineSpan: LineSpan,
  lineIdentifiers: readonly LineIdentifier[],
): number[] {
  const exactPositions = characterPosition <= lineSpan.end ? [characterPosition] : [];
  const [firstIdentifier, ...otherIdentifiers] = lineIdentifiers;

  if (!firstIdentifier || otherIdentifiers.length > 0) {
    return exactPositions;
  }

  const isOnFirstIdentifier =
    characterPosition >= firstIdentifier.start && characterPosition <= firstIdentifier.end;

  return isOnFirstIdentifier ? exactPositions : [...exactPositions, firstIdentifier.start];
}

function toIdentifierName(symbol: string): string {
  return symbol.trim().replace(/[(<].*$/, '').split('.').at(-1) ?? symbol;
}

function readLineSpan(sourceFile: ts.SourceFile, line: number, displayPath: string): LineSpan {
  const lineStarts = sourceFile.getLineStarts();
  const lineStart = lineStarts[line - 1];

  if (lineStart === undefined) {
    throw new LookupError(
      `Line ${line} is out of range: ${displayPath} has ${lineStarts.length} lines`,
    );
  }

  const nextLineStart = lineStarts[line] ?? sourceFile.text.length;
  const lineText = sourceFile.text.slice(lineStart, nextLineStart).replace(/\r?\n$/, '');

  return { end: lineStart + lineText.length, start: lineStart };
}

function listLineIdentifiers(sourceFile: ts.SourceFile, lineSpan: LineSpan): LineIdentifier[] {
  const identifiers: LineIdentifier[] = [];

  const visit = (node: ts.Node): void => {
    if (node.end <= lineSpan.start || node.pos >= lineSpan.end) {
      return;
    }

    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      const start = node.getStart(sourceFile);

      if (start >= lineSpan.start && start < lineSpan.end) {
        identifiers.push({ end: node.end, start, text: node.text });
      }

      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return identifiers;
}

function describeMissingSymbol(
  sourceFile: ts.SourceFile,
  symbolName: string,
  line: number,
  displayPath: string,
): string {
  const identifierLines = findIdentifierLines(sourceFile, symbolName);

  if (identifierLines.length === 0) {
    return `${symbolName} is not an identifier in ${displayPath}`;
  }

  const nearestLines = identifierLines
    .toSorted((left, right) => Math.abs(left - line) - Math.abs(right - line))
    .slice(0, MAX_SUGGESTED_LINES)
    .toSorted((left, right) => left - right);
  const lineLabel = nearestLines.length === 1 ? 'line' : 'lines';
  const nearestLinesLabel = `${lineLabel} ${nearestLines.join(', ')}`;

  return `${symbolName} is not on line ${line} of ${displayPath}; it is on ${nearestLinesLabel}`;
}

function findIdentifierLines(sourceFile: ts.SourceFile, symbolName: string): number[] {
  const identifierLines = new Set<number>();

  const visit = (node: ts.Node): void => {
    if ((ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) && node.text === symbolName) {
      identifierLines.add(
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      );
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return [...identifierLines];
}
