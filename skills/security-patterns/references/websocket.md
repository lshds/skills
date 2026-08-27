# WebSocket

Check origin and authenticate on connect. An open socket lets any client send
arbitrary messages.

## Origin allowlist and auth

Without an origin allowlist, any site can open the socket. Without first-message
auth, the first payload is already processed.

```typescript
// ❌ Incorrect: no origin allowlist or authentication on connect
server.on('connection', (socket) => {
  socket.on('message', (rawMessage) => processMessage(rawMessage))
})

// ✅ Correct: origin allowlist + first-message auth + schema validation
interface SocketAuthMessage {
  type: 'auth'
  token: string
}

interface SocketActionMessage {
  type: 'action'
  action: string
  channel?: string
}

type SocketMessage = SocketAuthMessage | SocketActionMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSocketMessage(
  rawMessage: unknown,
): SocketMessage | undefined {
  if (typeof rawMessage !== 'string') {
    return
  }

  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(rawMessage)
  } catch {
    return
  }

  if (!isRecord(parsedValue)) {
    return
  }

  if (parsedValue.type === 'auth' && typeof parsedValue.token === 'string') {
    return { type: 'auth', token: parsedValue.token }
  }

  if (
    parsedValue.type === 'action' &&
    typeof parsedValue.action === 'string'
  ) {
    return {
      type: 'action',
      action: parsedValue.action,
      channel:
        typeof parsedValue.channel === 'string'
          ? parsedValue.channel
          : undefined,
    }
  }

  return
}

function toMessageText(rawMessage: unknown): string | undefined {
  if (typeof rawMessage === 'string') {
    return rawMessage
  }

  if (Buffer.isBuffer(rawMessage)) {
    return rawMessage.toString('utf8')
  }

  return
}

const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
])
const WS_ACTIONS = new Set(['subscribe', 'unsubscribe', 'message'])

server.on('connection', (socket, request) => {
  const origin = request.headers.origin

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    socket.close(1008, 'Origin not allowed')
    return
  }

  let isAuthenticated = false

  socket.on('message', (rawMessage) => {
    const messageText = toMessageText(rawMessage)

    if (messageText === undefined) {
      socket.send(JSON.stringify({ error: 'Invalid message' }))
      return
    }

    const message = parseSocketMessage(messageText)

    if (!message) {
      socket.send(JSON.stringify({ error: 'Invalid message' }))
      return
    }

    if (!isAuthenticated) {
      const isValidAuthMessage =
        message.type === 'auth' && validateToken(message.token)

      if (!isValidAuthMessage) {
        socket.close(1008, 'Authentication required')
        return
      }

      isAuthenticated = true
      return
    }

    if (
      message.type !== 'action' ||
      !WS_ACTIONS.has(message.action) ||
      (message.channel !== undefined &&
        !/^[a-zA-Z0-9_-]+$/.test(message.channel))
    ) {
      socket.send(JSON.stringify({ error: 'Invalid message' }))
      return
    }

    processAction(socket, message)
  })
})
```

## Query tokens and limits

- Prefer auth in the first message over query-string tokens — query values end up in logs.
- Cookie-authenticated WebSocket upgrades need CSRF-equivalent protection.
- Rate-limit message volume per connection.
