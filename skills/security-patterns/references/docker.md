# Docker

Prefer digest-pinned base images, a minimal non-root runtime stage, and
BuildKit secret mounts over mutable tags, root containers, and `ARG` / `ENV`
secrets, so the image you ship is the image you reviewed and no credential
ends up in a layer. Attach an SBOM and provenance when pushing so the image
can be traced back to its build.

## Pin base images by digest

A tag such as `oven/bun:1-slim` or `latest` moves when the publisher pushes a
new build, so the same Dockerfile silently produces a different image — or a
compromised one.

```dockerfile
# ❌ Incorrect: mutable tag — rebuilds pull whatever the tag points to today
FROM oven/bun:1-slim

# ✅ Correct: tag for readability, digest for immutability
FROM oven/bun:1-slim@sha256:<digest>
```

- Resolve the digest with `docker buildx imagetools inspect oven/bun:1-slim`
  and let the repo’s dependency update bot bump it.
- Pin every `FROM`, including build stages.

## Minimal non-root runtime stage

A single-stage image ships compilers, dev dependencies, source, and a shell
to production, and running as root turns any code-execution bug into
root inside the container.

```dockerfile
# ❌ Incorrect: single stage; bun install may rewrite the lockfile; runs as root
FROM oven/bun:1-slim
WORKDIR /app
COPY . .
RUN bun install
USER root
CMD ["bun", "dist/server.js"]

# ✅ Correct: build stage compiles; runtime stage gets only production output and a non-root user
FROM oven/bun:1-slim@sha256:<digest> AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build && rm -rf node_modules && bun install --frozen-lockfile --production

FROM oven/bun:1-slim@sha256:<digest>
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/dist ./dist
USER bun
CMD ["bun", "dist/server.js"]
```

- Prefer `oven/bun:1-distroless` for the runtime stage when the app does not
  need a shell — no package manager left in the image. That image’s entrypoint
  is already `bun`, so `CMD` is the script path (`["dist/server.js"]`) and the
  runtime user is `nonroot`.
- Prefer `COPY` over `ADD`. Install with `bun install --frozen-lockfile`, then
  again with `--production` so devDependencies stay out of the runtime stage.
- Avoid `--privileged`, docker.sock mounts, and host path mounts of `/` or
  `/etc`.

## BuildKit secrets instead of ARG and ENV

`ARG` and `ENV` values persist in image layers, `docker history`, and build
provenance, so anyone who can pull the image can read them.

```dockerfile
# ❌ Incorrect: registry token via ARG; database URL baked into ENV
ARG NPM_TOKEN
ENV DATABASE_URL=postgres://user:pass@db/app
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && bun install --frozen-lockfile

# ✅ Correct: secret mounted for this RUN only — never written to a layer
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc bun install --frozen-lockfile
```

```bash
docker buildx build --secret id=npmrc,src=$HOME/.npmrc -t registry.example.com/api:1.4.0 .
```

- Runtime secrets (`DATABASE_URL`, API keys) come from the orchestrator’s
  secret store or a compose `env_file` at run time — never from the image.

## SBOM and provenance attestations

Without an SBOM nobody can answer "are we running the vulnerable version?"
for a pushed image, and without provenance nobody can prove which commit and
build produced it.

```bash
# ❌ Incorrect: image pushed with no record of its contents or how it was built
docker buildx build -t registry.example.com/api:1.4.0 --push .

# ✅ Correct: BuildKit attaches an SBOM and max-mode provenance to the pushed image
docker buildx build --sbom=true --provenance=mode=max \
  -t registry.example.com/api:1.4.0 --push .
```

- Max-mode provenance records build arguments — one more reason secrets
  never travel as `ARG`.

## .dockerignore

Without exclusions, `.env`, keys, and `.git` get copied into the build context and image.

```text
# ❌ Incorrect: empty ignore — secrets and VCS ship in the build context
# (no exclusions)

# ✅ Correct: exclude secrets and VCS from build context
.env
.env.*
**/*.pem
**/*key*
.git
node_modules
```
