# Injection

Parameterize untrusted input in queries, filters, templates, and commands.
String interpolation lets attackers run code or widen data access.

## SQL injection

Concatenating request values into SQL bypasses access controls and can exfiltrate or modify data.

```typescript
// ❌ Incorrect: SQL string interpolation from request input
const rows = await database.query(
  `SELECT * FROM users WHERE email = '${request.query.email}'`,
)

// ✅ Correct: parameterized query / ORM bind; narrow query values at the boundary
const email = request.query.email

if (typeof email !== 'string') {
  throw new Error('email required')
}

const rows = await database.query('SELECT * FROM users WHERE email = $1', [
  email,
])
const user = await database.user.findUnique({ where: { email } })
```

- ORM `.find*` calls bind parameters automatically; `.raw()`, `$queryRawUnsafe`, and string interpolation do not.

## NoSQL injection

Operator injection and string-built filters turn request JSON into query logic the attacker controls.

```typescript
// ❌ Incorrect: spread request filter — {"email":{"$ne":null}} matches all
const users = await usersCollection.find({
  ...request.body.filter,
})

// ❌ Incorrect: $where with interpolated input
const documents = await usersCollection.find({
  $where: `this.email === '${request.query.email}'`,
})

// ✅ Correct: allowlisted fields + typed operators; never $where from input
const email = request.body.email

if (typeof email !== 'string') {
  throw new Error('email required')
}

const users = await usersCollection.find({ email })
```

- Reject unknown keys; never pass raw request objects into `find` / `update` filters.
- Avoid `$where`, `$expr` built from strings, and map request values onto operator keys (`$gt`, `$ne`, `$regex`).

## GraphQL injection / abuse

String-built queries and unchecked aliases/depth turn the API into an arbitrary read engine.

```typescript
// ❌ Incorrect: concatenate user input into a GraphQL document
const graphqlDocument = `{ user(id: "${request.query.id}") { email role } }`
await graphqlClient.request(graphqlDocument)

// ✅ Correct: fixed document + variables; enforce depth/complexity at the server
const USER_QUERY = `
  query User($id: ID!) {
    user(id: $id) {
      email
    }
  }
`
const userId = request.query.id

if (typeof userId !== 'string') {
  throw new Error('id required')
}

await graphqlClient.request(USER_QUERY, { id: userId })
```

- Prefer variables over string interpolation in documents.
- Cap depth, complexity, and batch size on the server; field-level authz still applies per resolved object.

## Template injection

Server-side template engines that evaluate user strings as code (or rich template syntax) enable RCE or XSS in rendered output.

```typescript
import { render } from 'ejs'

// ❌ Incorrect: user string compiled as a template
const unsafeMarkup = await render(request.body.template, { user })

// ✅ Correct: fixed template file; user values as data only
const displayName = request.body.displayName

if (typeof displayName !== 'string') {
  throw new Error('displayName required')
}

const renderedHtml = await render('profile.ejs', { displayName })
```

- Never `eval`, `new Function`, or compile templates from request/body content.
- Escape or sanitize when the template language allows raw HTML.

## Command injection

Shell strings and `shell: true` pass user input to `/bin/sh`, enabling arbitrary command execution. Same rule for Bun’s shell helpers.

```typescript
import { exec, spawn } from 'node:child_process'

// ❌ Incorrect: command injection via shell string
exec(`convert ${request.body.filename} out.png`)

// ❌ Incorrect: shell: true + user input in command string
spawn(`echo ${request.query.message}`, { shell: true })

// ❌ Incorrect: Bun shell interpolates into a shell — treat like exec
await Bun.$`convert ${request.body.filename} out.png`

// ✅ Correct: fixed argv array; no shell (Node or Bun)
spawn('convert', [validatedPath, 'out.png'], { shell: false })
Bun.spawn(['convert', validatedPath, 'out.png'])
```

- Never use `exec`, `spawn({ shell: true })`, or `Bun.$` with user-influenced strings.
- Validate and normalize file paths before passing them as arguments.
