export const JSON_RPC_VERSION = '2.0';
export const JSON_RPC_PARSE_ERROR = -32700;

const LINE_FEED_BYTE = 0x0a;
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]+$/;
const CONTENT_LENGTH_PATTERN = /^\d+$/;
const CRLF_HEADER_BREAK = Buffer.from('\r\n\r\n');
const LF_HEADER_BREAK = Buffer.from('\n\n');

export type ExtractedStdin =
  | { kind: 'incomplete' }
  | { kind: 'invalid'; message: string; rest: Buffer; isContentLengthFramed: boolean }
  | { kind: 'skip'; rest: Buffer; isContentLengthFramed: boolean }
  | { kind: 'message'; rest: Buffer; isContentLengthFramed: boolean; value: unknown };

export interface DrainStdinResult {
  isContentLengthSession: boolean;
  remaining: Buffer;
}

export interface StdinMessageHandlers {
  onMessage: (value: unknown, isContentLengthFramed: boolean) => void;
  onInvalid: (message: string, isContentLengthFramed: boolean) => void;
}

interface FrameHeader {
  name: string;
  value: string;
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

  if (startsWithHeaderLine(buffer)) {
    return extractHeaderFramedMessage(buffer);
  }

  return extractNewlineMessage(buffer);
}

/**
 * Hands every complete frame in 'buffer' to 'handlers'. Once one frame is Content-Length framed,
 * the session stays Content-Length framed so replies use the same framing.
 *
 * @returns The bytes of the incomplete trailing frame and whether the session is Content-Length framed
 */
export function drainStdinBuffer(
  buffer: Buffer,
  isContentLengthSession: boolean,
  handlers: StdinMessageHandlers,
): DrainStdinResult {
  let remaining = buffer;
  let isContentLengthFramed = isContentLengthSession;

  while (true) {
    const frame = extractStdinMessage(remaining);

    switch (frame.kind) {
      case 'incomplete':
        return { isContentLengthSession: isContentLengthFramed, remaining };
      case 'invalid': {
        remaining = frame.rest;

        if (frame.isContentLengthFramed) {
          isContentLengthFramed = true;
        }

        handlers.onInvalid(frame.message, isContentLengthFramed);
        break;
      }
      case 'skip':
      case 'message': {
        remaining = frame.rest;

        if (frame.isContentLengthFramed) {
          isContentLengthFramed = true;
        }

        if (frame.kind === 'message') {
          handlers.onMessage(frame.value, isContentLengthFramed);
        }

        break;
      }
      default: {
        const exhaustiveCheck: never = frame;

        return exhaustiveCheck;
      }
    }
  }
}

export function writeJsonRpcMessage(payload: unknown, isContentLengthFramed: boolean): void {
  const json = JSON.stringify(payload);

  if (isContentLengthFramed) {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);

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
  const bodyStart = findBodyStart(buffer);

  if (bodyStart === undefined) {
    return { kind: 'incomplete' };
  }

  const headerBlock = buffer.subarray(0, bodyStart).toString('utf8');
  const contentLength = parseContentLength(parseHeaders(headerBlock));

  if (contentLength === undefined) {
    return {
      kind: 'invalid',
      message: 'Missing Content-Length header',
      rest: buffer.subarray(bodyStart),
      isContentLengthFramed: false,
    };
  }

  return extractContentLengthMessage(buffer, bodyStart, contentLength);
}

function extractContentLengthMessage(
  buffer: Buffer,
  bodyStart: number,
  bodyLength: number,
): ExtractedStdin {
  const bodyEnd = bodyStart + bodyLength;

  if (buffer.length < bodyEnd) {
    return { kind: 'incomplete' };
  }

  return parseStdinJsonMessage(
    buffer.subarray(bodyStart, bodyEnd),
    buffer.subarray(bodyEnd),
    true,
  );
}

function extractNewlineMessage(buffer: Buffer): ExtractedStdin {
  const newlineIndex = buffer.indexOf(LINE_FEED_BYTE);

  if (newlineIndex === -1) {
    return { kind: 'incomplete' };
  }

  const line = buffer.subarray(0, newlineIndex).toString('utf8').replace(/\r$/, '').trim();
  const rest = buffer.subarray(newlineIndex + 1);

  if (!line) {
    return { kind: 'skip', rest, isContentLengthFramed: false };
  }

  return parseStdinJsonMessage(Buffer.from(line, 'utf8'), rest, false);
}

function parseStdinJsonMessage(
  body: Buffer,
  rest: Buffer,
  isContentLengthFramed: boolean,
): ExtractedStdin {
  try {
    return {
      kind: 'message',
      rest,
      isContentLengthFramed,
      value: JSON.parse(body.toString('utf8')),
    };
  } catch (caught) {
    return {
      kind: 'invalid',
      message: caught instanceof Error ? caught.message : 'Invalid JSON',
      rest,
      isContentLengthFramed,
    };
  }
}

function startsWithHeaderLine(buffer: Buffer): boolean {
  const newlineIndex = buffer.indexOf(LINE_FEED_BYTE);
  const firstLine = (newlineIndex === -1 ? buffer : buffer.subarray(0, newlineIndex)).toString(
    'utf8',
  );
  const colonIndex = firstLine.indexOf(':');

  if (colonIndex <= 0) {
    return false;
  }

  return HEADER_NAME_PATTERN.test(firstLine.slice(0, colonIndex).trim());
}

/**
 * @returns The byte offset right after the first blank line ('\r\n\r\n' or '\n\n', whichever comes
 * first), or 'undefined' when the headers are not complete yet
 */
function findBodyStart(buffer: Buffer): number | undefined {
  const crlfIndex = buffer.indexOf(CRLF_HEADER_BREAK);
  const lfIndex = buffer.indexOf(LF_HEADER_BREAK);

  if (crlfIndex === -1 && lfIndex === -1) {
    return;
  }

  if (crlfIndex === -1) {
    return lfIndex + LF_HEADER_BREAK.length;
  }

  if (lfIndex === -1 || crlfIndex <= lfIndex) {
    return crlfIndex + CRLF_HEADER_BREAK.length;
  }

  return lfIndex + LF_HEADER_BREAK.length;
}

function parseHeaders(headerBlock: string): Map<string, string> {
  const headers = new Map<string, string>();

  for (const line of headerBlock.split(/\r?\n/)) {
    const header = parseHeaderLine(line);

    if (header) {
      headers.set(header.name, header.value);
    }
  }

  return headers;
}

function parseHeaderLine(line: string): FrameHeader | undefined {
  const colonIndex = line.indexOf(':');

  if (colonIndex <= 0) {
    return;
  }

  const name = line.slice(0, colonIndex).trim().toLowerCase();
  const value = line.slice(colonIndex + 1).trim();

  if (!HEADER_NAME_PATTERN.test(name) || !value) {
    return;
  }

  return { name, value };
}

function parseContentLength(headers: Map<string, string>): number | undefined {
  const rawContentLength = headers.get('content-length');

  if (!rawContentLength || !CONTENT_LENGTH_PATTERN.test(rawContentLength)) {
    return;
  }

  return Number(rawContentLength);
}
