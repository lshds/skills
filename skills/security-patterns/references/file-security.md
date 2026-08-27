# File Security

Resolve paths under an allowlisted root and check uploads by size and content.
User-controlled filenames can walk out of the directory or run a file.

## Path traversal

`path.join` alone does not reject `..` segments that escape the intended directory.

```typescript
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// ❌ Incorrect: path.join alone — ?file=../../etc/passwd escapes root
const fileBytes = await readFile(
  path.join('/var/data', String(request.query.file)),
)
response.send(fileBytes)

// ✅ Correct: resolve under root; reject paths that escape DATA_ROOT
const DATA_ROOT = path.resolve('/var/data')

class PathEscapeError extends Error {
  statusCode = 400
  constructor(message = 'path escapes root', options?: ErrorOptions) {
    super(message, options)
    this.name = 'PathEscapeError'
  }
}

const fileName = request.query.file

if (typeof fileName !== 'string') {
  throw new PathEscapeError()
}

const resolvedPath = path.resolve(DATA_ROOT, fileName)

if (
  resolvedPath !== DATA_ROOT &&
  !resolvedPath.startsWith(DATA_ROOT + path.sep)
) {
  throw new PathEscapeError()
}

const safeFileBytes = await readFile(resolvedPath)
response.type('application/octet-stream').send(safeFileBytes)
```
## Uploads

Trusting client `Content-Type` and `originalname` without checks allows oversized or malicious uploads.

```typescript
import { randomUUID } from 'node:crypto'

// ❌ Incorrect: no size/type check; trust client Content-Type / filename
app.post('/api/upload', async (request, response) => {
  await saveUpload(request.file.path, request.file.originalname)
  response.sendStatus(201)
})

// ✅ Correct: enforce size + allowlisted MIME; random storage name
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png'])

app.post('/api/upload', async (request, response) => {
  const uploadedFile = request.file

  if (
    !uploadedFile ||
    uploadedFile.size > MAX_UPLOAD_BYTES ||
    !ALLOWED_MIME_TYPES.has(uploadedFile.mimetype)
  ) {
    return response.sendStatus(400)
  }

  const storageId = randomUUID()
  await saveUpload(uploadedFile.path, storageId) // not originalname
  response.status(201).json({ id: storageId })
})
```

- Validate type with magic bytes where possible, not only the declared MIME.
- Never execute or serve user uploads as executable code.
