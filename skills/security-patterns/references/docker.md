# Docker

Run containers as non-root, pin base images, and inject secrets at runtime.
Baked-in credentials and `:latest` tags stay in image layers and drift.

## Dockerfile

Unpinned bases, root users, and `ENV`/`ARG` secrets persist in layers and registry history.

```dockerfile
# ❌ Incorrect: latest tag; secret in ENV/ARG; root user; COPY . . without ignore
FROM oven/bun:latest
ARG DATABASE_URL
ENV DATABASE_URL=postgres://user:pass@db/app
COPY . .
USER root
CMD ["bun", "src/server.ts"]

# ✅ Correct: pinned version; multi-stage; frozen lockfile; non-root runtime user
ARG BUN_VERSION=1.3.14
FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app/dist ./dist
USER bun
CMD ["bun", "dist/server.js"]
# DATABASE_URL etc. supplied at run time — not ARG/ENV in the image
```

- Inject secrets at runtime (orchestrator secrets, compose `env_file`, cloud secret store) — never bake into image layers or build-args.
- Prefer `COPY` over `ADD`; use `--frozen-lockfile` or `npm ci`; default `NODE_ENV=production`.
- Avoid `--privileged`, docker.sock mounts, and host path mounts of `/` or `/etc`.

## .dockerignore

Without exclusions, `.env`, keys, and `.git` get copied into the build context and image.

```dockerignore
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
