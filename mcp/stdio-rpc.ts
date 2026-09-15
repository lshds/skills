export const JSON_RPC_VERSION = '2.0';
export const JSON_RPC_PARSE_ERROR = -32700;

const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]+$/;
const CRLF_HEADER_BREAK = Buffer.from('\r\n\r\n');
const LF_HEADER_BREAK = Buffer.from('\n\n');

export type ExtractedStdin =
  | { kind: 'incomplete' }
  | { kind: 'invalid'; message: string; rest: Buffer; contentLength: boolean }
  | { kind: 'skip'; rest: Buffer; contentLength: boolean }
  | { kind: 'message'; rest: Buffer; contentLength: boolean; value: unknown };

export interface DrainStdinResult {
  remaining: Buffer;
  useContentLength: boolean;
}

export interface StdinMessageHandlers {
  onMessage: (value: unknown, contentLength: boolean) => void;
  onInvalid: (message: string, contentLength: boolean) => void;
}

/**
 * Pulls the next JSON-RPC stdin frame from a byte buffer.
 *
 * Content-Length headers may appear in any order. Length is measured in bytes.
 */
export function extractStdinMessage(buffer: Buffer): ExtractedStdin {
  if (buffer.length === 0) {
    return { kind: 'incomplete' };
  }

  if (looksLikeHeaderBlock(buffer)) {
    return extractHeaderFramedMessage(buffer);
  }

  return extractNewlineMessage(buffer);
}

export function drainStdinBuffer(
  buffer: Buffer,
  useContentLength: boolean,
  handlers: StdinMessageHandlers,
): DrainStdinResult {
  let remaining: Buffer = buffer;
  let contentLength = useContentLength;

  while (true) {
    const extracted = extractStdinMessage(remaining);

    switch (extracted.kind) {
      case 'incomplete':
        return { remaining, useContentLength: contentLength };
      case 'invalid': {
        remaining = extracted.rest;

        if (extracted.contentLength) {
          contentLength = true;
        }

        handlers.onInvalid(extracted.message, contentLength);
        break;
      }
      case 'skip':
      case 'message': {
        remaining = extracted.rest;

        if (extracted.contentLength) {
          contentLength = true;
        }

        if (extracted.kind === 'message') {
          handlers.onMessage(extracted.value, contentLength);
        }

        break;
      }
      default: {
        const exhaustiveCheck: never = extracted;

        return exhaustiveCheck;
      }
    }
  }
}

export function writeJsonRpcMessage(payload: unknown, contentLength: boolean): void {
  const json = JSON.stringify(payload);

  if (contentLength) {
    const bytes = Buffer.byteLength(json, 'utf8');
    process.stdout.write(`Content-Length: ${bytes}\r\n\r\n${json}`);
    return;
  }

  process.stdout.write(`${json}\n`);
}

export function createParseErrorPayload(message: string): unknown {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id: null,
    error: { code: JSON_RPC_PARSE_ERROR, message },
  };
}

function extractHeaderFramedMessage(buffer: Buffer): ExtractedStdin {
  const split = findHeaderBodySplit(buffer);

  if (split === undefined) {
    return { kind: 'incomplete' };
  }

  const headerBlock = buffer.subarray(0, split.bodyStart).toString('utf8');
  const contentLength = parseContentLength(parseHeaders(headerBlock));

  if (contentLength === undefined) {
    return {
      kind: 'invalid',
      message: 'Missing Content-Length header',
      rest: buffer.subarray(split.bodyStart),
      contentLength: false,
    };
  }

  return extractContentLengthMessage(buffer, split.bodyStart, contentLength);
}

function extractContentLengthMessage(
  buffer: Buffer,
  bodyStart: number,
  length: number,
): ExtractedStdin {
  if (buffer.length < bodyStart + length) {
    return { kind: 'incomplete' };
  }

  return parseStdinJsonMessage(
    buffer.subarray(bodyStart, bodyStart + length),
    buffer.subarray(bodyStart + length),
    true,
  );
}

function extractNewlineMessage(buffer: Buffer): ExtractedStdin {
  const newlineIndex = buffer.indexOf(0x0a);

  if (newlineIndex === -1) {
    return { kind: 'incomplete' };
  }

  const line = buffer.subarray(0, newlineIndex).toString('utf8').replace(/\r$/, '').trim();
  const rest = buffer.subarray(newlineIndex + 1);

  if (line.length === 0) {
    return { kind: 'skip', rest, contentLength: false };
  }

  return parseStdinJsonMessage(Buffer.from(line, 'utf8'), rest, false);
}

function parseStdinJsonMessage(body: Buffer, rest: Buffer, contentLength: boolean): ExtractedStdin {
  try {
    return {
      kind: 'message',
      rest,
      contentLength,
      value: JSON.parse(body.toString('utf8')),
    };
  } catch (caught) {
    return {
      kind: 'invalid',
      message: caught instanceof Error ? caught.message : 'Invalid JSON',
      rest,
      contentLength,
    };
  }
}

function looksLikeHeaderBlock(buffer: Buffer): boolean {
  const newlineIndex = buffer.indexOf(0x0a);
  const firstLine = (newlineIndex === -1 ? buffer : buffer.subarray(0, newlineIndex)).toString(
    'utf8',
  );
  const colonIndex = firstLine.indexOf(':');

  if (colonIndex <= 0) {
    return false;
  }

  return HEADER_NAME_PATTERN.test(firstLine.slice(0, colonIndex).trim());
}

function findHeaderBodySplit(buffer: Buffer): { bodyStart: number } | undefined {
  const crlfIndex = buffer.indexOf(CRLF_HEADER_BREAK);
  const lfIndex = buffer.indexOf(LF_HEADER_BREAK);

  if (crlfIndex === -1 && lfIndex === -1) {
    return undefined;
  }

  if (crlfIndex === -1) {
    return { bodyStart: lfIndex + LF_HEADER_BREAK.length };
  }

  if (lfIndex === -1 || crlfIndex <= lfIndex) {
    return { bodyStart: crlfIndex + CRLF_HEADER_BREAK.length };
  }

  return { bodyStart: lfIndex + LF_HEADER_BREAK.length };
}

function parseHeaders(headerBlock: string): Map<string, string> {
  const headers = new Map<string, string>();

  for (const line of headerBlock.split(/\r?\n/)) {
    const colonIndex = line.indexOf(':');

    if (line.length > 0 && colonIndex > 0) {
      const name = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();

      if (HEADER_NAME_PATTERN.test(name) && value.length > 0) {
        headers.set(name, value);
      }
    }
  }

  return headers;
}

function parseContentLength(headers: Map<string, string>): number | undefined {
  const rawValue = headers.get('content-length');

  if (rawValue === undefined || !/^\d+$/.test(rawValue)) {
    return undefined;
  }

  return Number(rawValue);
}
