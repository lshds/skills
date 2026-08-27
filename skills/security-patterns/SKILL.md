---
name: security-patterns
description: >-
  Security guidelines for TypeScript / Bun / Expo / Vite / Next applications.
  This skill should be used when writing, reviewing, or auditing authn/authz,
  secrets, injection, XSS, SSRF, client token/env handling, or supply-chain
  installs to ensure high-confidence trust-boundary controls. Prefer
  source→sink confirmation over pattern-match alerts. Triggers on Server
  Actions, IDOR, JWT/cookies, public env prefixes, SecureStore, Docker
  hardening, lockfile, npm/pnpm/yarn/bun audit, postinstall,
  trustedDependencies, allowBuilds, allowScripts, or OWASP-style reviews.
---

# Security Skills

Security for TypeScript / Bun / Expo / Vite / Next: trust boundaries, authn/authz,
injection, secrets, supply chain, and related threats. Prefer HIGH-confidence
controls with confirmed attacker-controlled input.

**Domain:** trust-boundary controls for TypeScript / Bun / Expo / Vite / Next
applications.
**Owns:** authn/authz, injection, XSS, SSRF, CSRF, secrets and public env
prefixes, file uploads/paths, Docker hardening, supply-chain installs,
misconfiguration, prototype pollution, DOM clobbering, WebSocket, LLM prompt
injection; write vs audit output.
**Does not own:** HTTP resource design and envelopes; in-process error taxonomy;
request-thread I/O placement; schema modeling.

## When to activate

- Writing or hardening handlers, Server Actions, or auth-protected routes
- Choosing token transport, session cookies, or client/native secret storage
- Adding runtime validation, parameterized queries, or URL/redirect allowlists
- Reviewing authn/authz, IDOR, mass assignment, injection, SSRF, or XSS sinks
- Checking secrets, `.env`, or public env prefixes (`NEXT_PUBLIC_*` / `VITE_*` / `EXPO_PUBLIC_*`)
- Hardening Dockerfile / Compose / container runtime, lockfile installs, install scripts, or trust/allow-builds lists
- Assessing prototype pollution, DOM clobbering, WebSocket/CSWSH, or LLM prompt injection
- Running a security review, dependency audit, or OWASP-style pass on a named scope

## Core Concepts

### Write vs audit

Pick one mode from the user ask — don’t mix output shapes. **Write** (implement,
fix, refactor, harden, “make this safe”): load the primary ref; apply ✅ patterns
in code; no review report unless asked. **Audit** (security review, vuln pass,
“find issues in …”): named scope only; source→sink; HIGH findings (+ Needs
verification); use the report template in **Output Format**. If both appear, audit
first, then implement — still one primary ref per finding/topic.

### Audit confidence

Before reporting, confirm: (1) source → sink, (2) no validation/sanitization on
the path, (3) config / middleware / framework defaults do not already block it.
HIGH = report with severity; MEDIUM = Needs verification only; LOW = do not
report. Default: HIGH only. Do not flag tests (unless reviewing test security),
dead/commented code, docs, or server-controlled config/env alone. Auth-gated ≠
safe — only report if authz is missing/broken after auth.

### Attacker vs server-controlled

| Investigate | Usually not a vuln alone |
| --- | --- |
| `request.body` / query / path | `process.env`, deploy config |
| Headers, cookies (unsigned) | Hardcoded constants |
| Uploads, Expo deep links | Signed session values |
| Other users’ stored data | Internal URLs from config |

Trace source → sink before flagging (audit) or before trusting a value in new
code (write).

### Validate at boundary

Runtime schema (types/casts are not enough), rate limits, response field
filtering. Not IDOR/mass assignment; not CORS. See
[api-security.md](references/api-security.md).

### Authentication

Sessions, credentials, JWT/cookies; tokens in headers or httpOnly cookies, not
query strings. Expo deep links: allowlisted paths, one-time codes — not access
tokens in the URL. See [authentication.md](references/authentication.md).

### Authorization

Object-level access (IDOR), privilege checks, mass assignment / allowlist
updates. Auth **inside** Server Actions and exported handlers — Next middleware
or layout alone is not enough. Not token transport. See
[authorization.md](references/authorization.md).

### Injection

Parameterized queries / ORM binds; never string-interpolate SQL, NoSQL filters,
GraphQL documents, templates, or shell. No `exec` / `spawn({ shell: true })` /
`Bun.$` with user-influenced strings. See
[injection.md](references/injection.md).

### SSRF

User-controlled URL into `fetch` or redirect → allowlist scheme/host;
server-configured base URLs are fine. See [ssrf.md](references/ssrf.md).

### XSS

JSX text interpolation is escaped — do not flag by default. Flag
`dangerouslySetInnerHTML` and user-controlled `href`/`src`/`action`. See
[xss.md](references/xss.md).

### CSRF

Cookie/session auth on mutating browser endpoints: CSRF token lifecycle +
SameSite. Not CORS. See [csrf.md](references/csrf.md).

### Secrets and client leak

No hardcoded secrets in source or logs. `NEXT_PUBLIC_*` / `VITE_*` /
`EXPO_PUBLIC_*` ship to the client. Prefer httpOnly Secure cookies; else
short-lived web storage (XSS risk); native SecureStore — not AsyncStorage. See
[data-protection.md](references/data-protection.md).

### File security

Uploads (type/size) and paths built from user input — resolve under an
allowlisted root. See [file-security.md](references/file-security.md).

### Docker

Non-root user, pinned base image; secrets at runtime only; `.dockerignore`
excludes `.env` and keys. See [docker.md](references/docker.md).

### Supply chain

Install CI/prod from the committed lockfile; treat install scripts as
execution only when this manager will run them (npm `allowScripts`, pnpm
`allowBuilds`, Bun default allowlist or `trustedDependencies`, Yarn
`enableScripts` / `dependenciesMeta`); run the repo’s dependency audit.
If anything is uncertain, always ask. See
[supply-chain.md](references/supply-chain.md).

### Misconfiguration

CORS allowlist, security headers, no debug/stack leaks in production. See
[misconfiguration.md](references/misconfiguration.md).

### Prototype pollution

Deep-merge of untrusted JSON must skip `__proto__` / `constructor` /
`prototype`; prefer null-prototype objects or `Map`. See
[prototype-pollution.md](references/prototype-pollution.md).

### DOM clobbering

Untrusted HTML `id`/`name` can shadow `document` APIs — use `window.*` and strip
clobberable attributes. See [dom-clobbering.md](references/dom-clobbering.md).

### WebSocket

Origin allowlist, authenticate before actions, validate message shape; avoid
tokens in query strings. See [websocket.md](references/websocket.md).

### LLM prompt injection

Delimit untrusted document content; never follow instructions inside it; validate
model output shape. See [llm-prompt-injection.md](references/llm-prompt-injection.md).

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Flag from pattern match alone | Confirm source → sink and that no mitigation already blocks it |
| Trust middleware / layout as the only authz gate | Authn + authz inside each Server Action / exported handler |
| Secrets in `NEXT_PUBLIC_*` / `VITE_*` / `EXPO_PUBLIC_*` | Server-only env for secrets; public prefixes for non-secrets only |
| String-interpolate SQL, shell, or `Bun.$` | Parameterized queries / fixed argv (`spawn` / `Bun.spawn`) |
| Emit a security-review report on a write / harden ask | Apply ✅ patterns in code; report template only in Audit mode (Output Format) |
| CI `npm install`, or `--no-audit` with no audit job | Frozen lockfile install; run the manager’s audit |
| Flag every `postinstall` as executing, or grant trust unread | Confirm this manager will run it; read the script before `allowScripts` / `allowBuilds` / `trustedDependencies` / `dependenciesMeta` |

## Workflow

1. Detect Write vs Audit from the user ask (Write vs audit).
2. Open only the matching Practice areas ref — don’t load every file.
3. **Write:** implement or harden against Core Concepts and Common mistakes;
   ship safe code; skip the report template unless the user asks for a review
   write-up.
4. **Audit:** confirm each finding with Audit confidence; report each issue once
   under its primary category. Use Output Format (or when the user explicitly
   asks for a security review write-up). If none: "No high-confidence
   vulnerabilities identified."

## Output Format

```markdown
## Security Review: [File/Component Name]

### Summary
- **Findings**: X (Y Critical, Z High, ...)
- **Risk Level**: Critical/High/Medium/Low
- **Confidence**: High/Mixed

### Findings

#### [VULN-001] [Vulnerability Type] (Severity)
- **Location**: `file.ts:123`
- **Confidence**: High
- **Issue**: [What the vulnerability is]
- **Impact**: [What an attacker could do]
- **Evidence**:
  ```ts
  [Vulnerable code snippet]
  ```
- **Fix**: [How to remediate]

### Needs Verification

#### [VERIFY-001] [Potential Issue]
- **Location**: `file.ts:456`
- **Question**: [What needs to be verified]
```

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| Input validation / rate limits / response filtering | [api-security.md](references/api-security.md) |
| Authn / JWT / session cookies / token transport / Expo deep links | [authentication.md](references/authentication.md) |
| IDOR / privilege / mass assignment / Actions authz / Next middleware limits | [authorization.md](references/authorization.md) |
| SQL / NoSQL / GraphQL / template / command injection (incl. Bun) | [injection.md](references/injection.md) |
| SSRF / open redirects | [ssrf.md](references/ssrf.md) |
| XSS sinks / URL attributes | [xss.md](references/xss.md) |
| CSRF tokens / SameSite | [csrf.md](references/csrf.md) |
| Secrets / public env / token storage / logs | [data-protection.md](references/data-protection.md) |
| Uploads / path traversal | [file-security.md](references/file-security.md) |
| Dockerfile / `.dockerignore` / runtime secrets | [docker.md](references/docker.md) |
| Lockfile / dependency audit / install scripts / allowScripts / trustedDependencies / allowBuilds | [supply-chain.md](references/supply-chain.md) |
| CORS / headers / production errors | [misconfiguration.md](references/misconfiguration.md) |
| Prototype pollution / deep merge | [prototype-pollution.md](references/prototype-pollution.md) |
| DOM clobbering via `id` / `name` | [dom-clobbering.md](references/dom-clobbering.md) |
| WebSocket origin / auth / CSWSH | [websocket.md](references/websocket.md) |
| LLM prompt injection | [llm-prompt-injection.md](references/llm-prompt-injection.md) |
