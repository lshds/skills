# API Security

Prefer runtime schema, rate limits, and response field filtering at the API
edge. TypeScript types do not enforce runtime behavior.

## Input validation

Runtime schema at the handler — casting `request.body` accepts malformed or malicious payloads that types alone would miss.

```typescript
import { z } from 'zod'

// ❌ Incorrect: cast only — no runtime schema check on request body
app.post('/api/items', async (request, response) => {
  const itemInput = request.body as CreateItemInput
  await database.item.create({ data: itemInput })
  response.json({ ok: true })
})

// ✅ Correct: runtime schema parse before use
const createItemSchema = z.object({
  title: z.string().min(1).max(120),
  quantity: z.number().int().positive(),
})

app.post('/api/items', requireAuth, async (request, response) => {
  const itemInput = createItemSchema.parse(request.body)
  const item = await database.item.create({
    data: { ...itemInput, ownerId: request.user.id },
  })

  response.json({ id: item.id, title: item.title, quantity: item.quantity })
})
```

- Prefer the repo’s schema library (Zod, etc.) when present.
- Schema validation here is the security control — not a substitute for object-level authz.

## Rate limiting

Unlimited login attempts enable credential stuffing and brute-force attacks.

```typescript
import { rateLimit } from './rate-limit'

// ❌ Incorrect: unlimited login attempts on auth endpoint
app.post('/api/login', handleLogin)

// ✅ Correct: rate-limit before handler runs
const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000
const LOGIN_RATE_LIMIT_MAX = 10

app.post(
  '/api/login',
  rateLimit({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
  }),
  handleLogin,
)
```

## Response filtering

Serializing full database records can leak password hashes, secrets, and internal fields the client must not see.

```typescript
// ❌ Incorrect: leak password hash / internal fields to client
response.json(user)

// ✅ Correct: return only fields the client needs
response.json({ id: item.id, title: item.title, quantity: item.quantity })
```
