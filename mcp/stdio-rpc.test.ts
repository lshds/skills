import { describe, expect, test } from 'bun:test';

import {
  createParseErrorPayload,
  drainStdinBuffer,
  extractStdinMessage,
  JSON_RPC_PARSE_ERROR,
} from './stdio-rpc';

function encodeContentLengthMessage(value: unknown, headers: string[] = []): Buffer {
  const json = JSON.stringify(value);
  const headerLines = [...headers, `Content-Length: ${Buffer.byteLength(json, 'utf8')}`];

  return Buffer.concat([Buffer.from(`${headerLines.join('\r\n')}\r\n\r\n`), Buffer.from(json)]);
}

describe('stdio-rpc', () => {
  test('should read Content-Length as bytes when the JSON contains non-ASCII', () => {
    const value = {
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
      params: { file: 'exempel/fil.ts' },
    };

    const extracted = extractStdinMessage(encodeContentLengthMessage(value));

    expect(extracted).toMatchObject({ kind: 'message', contentLength: true, value });
  });

  test('should honor Content-Length when it is not the first header', () => {
    const value = { jsonrpc: '2.0', id: 2, method: 'initialize' };
    const extracted = extractStdinMessage(
      encodeContentLengthMessage(value, [
        'Content-Type: application/vscode-jsonrpc; charset=utf-8',
      ]),
    );

    expect(extracted).toMatchObject({ kind: 'message', contentLength: true, value });
  });

  test('should keep the following frame when the first JSON payload is invalid', () => {
    const validValue = { jsonrpc: '2.0', id: 3, method: 'ping' };
    const invalidBody = '{"nope"';
    const buffer = Buffer.concat([
      Buffer.from(`Content-Length: ${Buffer.byteLength(invalidBody, 'utf8')}\r\n\r\n`),
      Buffer.from(invalidBody),
      encodeContentLengthMessage(validValue),
    ]);
    const messages: unknown[] = [];
    const invalids: string[] = [];

    const drained = drainStdinBuffer(buffer, false, {
      onInvalid: (message) => {
        invalids.push(message);
      },
      onMessage: (value) => {
        messages.push(value);
      },
    });

    expect(invalids).toHaveLength(1);
    expect(messages).toEqual([validValue]);
    expect(drained.remaining.length).toBe(0);
    expect(drained.useContentLength).toBe(true);
  });

  test('should parse newline-delimited JSON when no headers are present', () => {
    const value = { jsonrpc: '2.0', id: 4, method: 'ping' };
    const extracted = extractStdinMessage(Buffer.from(`${JSON.stringify(value)}\n`));

    expect(extracted).toMatchObject({ kind: 'message', contentLength: false, value });
  });

  test('should build a JSON-RPC parse error payload', () => {
    expect(createParseErrorPayload('Unexpected token')).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: JSON_RPC_PARSE_ERROR, message: 'Unexpected token' },
    });
  });
});
