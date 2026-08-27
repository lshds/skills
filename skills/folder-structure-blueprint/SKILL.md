---
name: folder-structure-blueprint
description: >-
  Folder structure guidelines for monorepo and polyrepo layouts. This skill
  should be used when documenting layout or deciding where a file or package
  belongs so placement stays short and matches the observed tree. Match
  workspace roots, packages, and role folders as they exist in the repo.
  Triggers on tasks involving folder structure, blueprint, monorepo, polyrepo,
  file placement, package boundaries, or naming.
---

# Folder Structure

Repo layout for monorepo or polyrepo: detect stack and repo mode, then answer
placement or write a short blueprint from the observed tree.

**Domain:** workspace roots, package boundaries, and where new code goes at
repo/package level across stacks.
**Owns:** monorepo vs polyrepo classification, observed tree documentation,
flat role folders under `src/*` (or the repo’s source root), package / module
naming and path aliases as configured, and file placement against existing
packages or role folders.
**Does not own:** architecture diagrams; clean-layer redesign; import-graph or
dependency audits; CI / infra folder layout; or rewriting a mature tree to
match greenfield defaults.

## When to activate

- Deciding which package or `src/*` folder a new file belongs in
- Writing or updating `FOLDER_STRUCTURE.md`
- Classifying monorepo vs polyrepo or documenting workspace roots
- Choosing greenfield layout when there is no usable workspace or `src/*`
  layout yet
- Capturing package names, path aliases, or naming from the observed tree

## Core Concepts

### Place vs blueprint

Pick one mode from the user ask.

- **Place** (file or package placement): answer with the target path and a
  one-line why against the observed tree. Write or update `FOLDER_STRUCTURE.md`
  only when the user asks for a blueprint.
- **Blueprint** (document layout, write/update `FOLDER_STRUCTURE.md`, map the
  repo): write or update the root doc using Output Format.
- If both are asked, place first, then blueprint.

### Auto-detect

Classify **monorepo vs polyrepo** first, then scan stack markers and path
aliases from whatever manifests the repo actually uses.

**Monorepo** when any of:

- Multiple packages / modules under shared workspace roots (`apps/` +
  `packages/`, or equivalent)
- Workspace config: npm / yarn / bun (`package.json` `workspaces`), pnpm
  (`pnpm-workspace.yaml`), Cargo workspace, Go workspace / multi-module,
  Poetry / uv workspace, Bazel / Nx / Pants, or similar
- Top-level task runner for many packages (`turbo.json`, root `Makefile`, and
  the like)

**Polyrepo** when:

- One primary package / module at the repo root
- No sibling workspace layout or multi-package workspace config

Then note (only what is present):

- Package / module manifests and lockfiles (e.g. `package.json`, `go.mod`,
  `Cargo.toml`, `pyproject.toml`, `pom.xml`, matching lockfiles)
- Language / build config (e.g. `tsconfig*.json`, `*.csproj`, `build.gradle*`)
- Frameworks and app config as present
- Tooling and env files as present
- Path aliases / module paths from the stack’s config (e.g. `tsconfig` paths,
  Go module path, package `exports`)

Placement and tree detail for the chosen mode live in the matching Practice
area ref.

### Prefer observed layout

Document or place against what exists. Greenfield defaults live in the matching
Practice area ref — only when there is no usable layout yet (no workspace roots
and no meaningful `src/*` role folders). A messy-but-real tree still counts as
observed layout.

### Flat role folders

Inside a package, prefer flat **role folders** under `src/*`
(`components/`, `services/`, `pages/` / `screens/`, `hooks/`). Match the
repo’s names and source root when they already differ.

## Workflow

1. Pick **place** or **blueprint** from Place vs blueprint above.
2. Auto-detect monorepo vs polyrepo from Core Concepts.
3. Open the matching Practice areas ref for that mode.
4. **Place:** name the owning package (if monorepo) and the observed folder;
   stop. **Blueprint:** write or update `FOLDER_STRUCTURE.md` with Output Format.

**Done when (place):**

- [ ] Target path uses an existing package or role folder
- [ ] One-line rationale; blueprint file only when asked

**Done when (blueprint):**

- [ ] Repo mode matches workspace / manifest signals
- [ ] Tree reflects the real repo (matches the Practice area ref)
- [ ] Path aliases and package / module names match the repo’s config
- [ ] Placement guidance points at existing packages / role folders
- [ ] `Last updated` uses today’s calendar date

## Output Format

**Place** — short reply (path + why):

```markdown
**Path:** `<package?>/<observed folder>/<file>`
**Why:** <one line against the observed tree>
```

**Blueprint** — write or update `FOLDER_STRUCTURE.md` at the repo root. Keep it
short and actionable; fill every section from the matching Practice area ref
and the observed repo:

```markdown
# Folder structure

## Detected stack
- Repo mode: monorepo | polyrepo
- Package / module system: <from manifests and lockfiles>
- Frameworks / tooling: <from config files>
- Path aliases / module paths: <from stack config>

## Overview
<one short paragraph: observed roots + flat role folders under src/*>

## Tree
repo/
├── <observed roots and folders>
├── <root manifest when present>
└── <lockfile / workspace marker when present>

## Key directories
- `<path>` — <purpose as used in this repo>

## File placement
<UI / helpers / shared → existing folders>

## Naming conventions
<package / module names and aliases as configured>

## Where to add new code
<new screen / feature / shared → existing package or role folder>

## Last updated
<today's date as YYYY-MM-DD>
```

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Monorepo / workspace roots / packages | [monorepo.md](references/monorepo.md) |
| Polyrepo / single package / `src/*` roles | [polyrepo.md](references/polyrepo.md) |
