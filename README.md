# skills

Shared configuration for AI-assisted software development. The repository
defines session-wide rules, domain specialists (agents), and on-demand skills
so that coding assistants apply the same conventions across tools.

| This repository | Cursor | Claude | GitHub Copilot |
| --- | --- | --- | --- |
| `agents/` | `.cursor/agents/` | `.claude/agents/` | `AGENTS.md` |
| `rules/` | `.cursor/rules/` | `.claude/rules/` | `.github/instructions/` |
| `skills/` | `.cursor/skills/` | `.claude/skills/` | `.github/skills/` |

## Structure

Three layers, each with a distinct role:

- **Rules** (`rules/`) — session defaults. Three are always on (`000-standards`,
  `060-security`, `090-routing`); the rest load when the task matches. If a
  skill conflicts with a rule, the rule takes precedence.
- **Agents** (`agents/`) — specialists for a domain. Code-domain agents ship
  **Skills**; tracker / MCP agents ship **Tools** — not both. Each loads only
  what the current task needs.
- **Skills** (`skills/<name>/`) — domain guidance. `SKILL.md` is the index;
  worked defaults live in `references/`. Skills are self-contained.

```
rules/   always-on: 000, 060, 090 — others on demand
agents/  Skills or Tools for the task — not both
skills/  SKILL.md index + optional references/
```

## What’s in the repo

### Agents

| Agent | Responsibility |
| --- | --- |
| `backend-agent` | Server-side APIs, services, and validation |
| `db-agent` | Schema, migrations, SQL, and data-access hygiene |
| `frontend-agent` | User interfaces for web and native clients |
| `issue-agent` | Issue tracking in Linear, Jira, and GitLab (Tools, not Skills) |

### Rules

| File | Apply | Topic |
| --- | --- | --- |
| `000-standards` | always | Baseline working standards |
| `010-git` | on demand | Version control |
| `020-code` | on demand | Implementation conventions |
| `030-merge-request` | on demand | Merge requests |
| `040-tests` | on demand | Testing policy |
| `050-dependencies` | on demand | Package management |
| `060-security` | always | Security baseline |
| `070-debug` | on demand | Debugging |
| `080-review` | on demand | Code review |
| `085-issues` | on demand | Issue definition of done |
| `090-routing` | always | Agent routing |

### Skills

| Skill | Scope |
| --- | --- |
| `accessibility-patterns` | Keyboard, ARIA, and screen-reader support |
| `angular-patterns` | Angular components, routing, forms, and SSR |
| `api-design` | REST resource design, status codes, versioning, and OpenAPI docs (Redoc, Scalar) |
| `backend-patterns` | Request-path I/O, validation, caching, jobs, logging, and environment |
| `database-design-patterns` | Relational schema, keys, relations, and indexing |
| `database-patterns` | Migrations, queries, transactions, and ORM usage |
| `error-handling-patterns` | Error taxonomy, mapping, and retries |
| `expo-react-native-patterns` | Expo Router, native UI, and platform-specific code |
| `folder-structure-blueprint` | Repository layout and package placement |
| `frontend-patterns` | Component boundaries, state, async UI, client logging, and environment |
| `nextjs-patterns` | Next.js App Router, caching, and server actions |
| `react-patterns` | React components, hooks, data fetching, and composition |
| `security-patterns` | Authentication, authorization, injection, and secrets |
| `styling-patterns` | Design tokens, CSS, Tailwind, and NativeWind |
| `testing-patterns` | Unit, integration, component, and end-to-end tests |
| `typescript-standards` | Strict TypeScript typing and conventions |

## Extending

New agents, skills, and references follow [TEMPLATE.md](TEMPLATE.md). Copy a
`_template_*.md` file, fill the placeholders, then delete leftover comments,
unused optional sections, and the Example.

When a new agent or skill ships, add a row under What’s in the repo. Planned
work still to ship: [TODO.md](TODO.md).
