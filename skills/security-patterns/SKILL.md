---
name: security-patterns
description: >-
  Security guidelines for TypeScript / Bun / Expo / Vite / Next applications.
  This skill should be used when writing, reviewing, or auditing authn/authz,
  secrets, injection, XSS, CSRF, SSRF, or supply-chain installs to ensure
  high-confidence trust-boundary controls. Prefer source→sink confirmation over
  pattern-match alerts. Triggers on authorization inside Server Actions, IDOR,
  passkeys, JWT/cookies, CSP, Trusted Types, Sec-Fetch-Site, public env prefixes,
  SecureStore, Docker hardening, lockfile, minimumReleaseAge, postinstall,
  trustedDependencies, allowBuilds, allowScripts, dependency audit, or OWASP reviews.
---

# Security Skills

Security for TypeScript / Bun / Expo / Vite / Next: trust boundaries, authn/authz,
injection, secrets, and supply chain. Prefer HIGH-confidence controls with
confirmed attacker-controlled input.

**Domain:** trust-boundary controls for TypeScript / Bun / Expo / Vite / Next
applications.
**Owns:** authn/authz, injection, XSS, SSRF, CSRF, secrets and public env prefixes,
file uploads/paths, Docker hardening, supply-chain installs, misconfiguration (CORS,
headers, CSP, Trusted Types), prototype pollution, DOM clobbering, WebSocket, LLM
prompt injection; write vs audit output.
**Does not own:** HTTP resource design and envelopes; in-process error taxonomy;
request-thread I/O placement; schema modeling.

## When to activate

- Writing or hardening handlers, Server Actions, or auth-protected routes
- Choosing passkeys, password hashing, token transport, session cookies, or client/native secret storage
- Adding runtime validation, parameterized queries, URL/redirect allowlists, or CSRF origin checks
- Reviewing authn/authz, IDOR, mass assignment, injection, SSRF, or XSS sinks
- Checking secrets, `.env`, or public env prefixes (`NEXT_PUBLIC_*` / `VITE_*` / `EXPO_PUBLIC_*`)
- Setting CSP, Trusted Types, CORS, or security headers; hardening Dockerfiles, lockfile installs, or install-script grants
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

### Match the repo

Read installed versions from `package.json` and the lockfile (plus the auth library config, `Dockerfile`, and header/CSP config). Follow the patterns already in the tree; greenfield defaults apply only where nothing contradicts them. When code lags behind what the installed version supports, finish the task in the existing style, then propose the migration once — old → new, why, file count, risk — and wait for a yes. Never fold it into the current change. In review, report the gap as a finding instead.

Version signals:

- bcrypt / PBKDF2 password hashes → Argon2id with rehash on the next successful login (when an Argon2id implementation is already available in the runtime or installed libraries)
- session cookie without a prefix → `__Host-` prefixed cookie (supported by all current browsers)
- CSRF tokens only → add a `Sec-Fetch-Site` check (evergreen browsers send Fetch Metadata)
- CSP host allow-list or `'unsafe-inline'` scripts → nonce + `'strict-dynamic'` (CSP Level 3; all current browsers)
- `FROM oven/bun:1-slim` → `FROM oven/bun:1-slim@sha256:<digest>` (any Docker / BuildKit)

### Audit confidence

Report only after confirming source → sink, no sanitization on the path, and no
framework or config mitigation. HIGH = report; MEDIUM = Needs verification; LOW
= skip. Classify attacker- vs server-controlled values the same way before
trusting one in new code. See [audit-method.md](references/audit-method.md).

### Authentication

Passkeys (WebAuthn) as primary sign-in when the product allows. Passwords:
Argon2id, NIST SP 800-63B-4 length rules, no composition or forced rotation.
Session cookies `__Host-` + `HttpOnly` + `Secure` + `SameSite=Lax`; tokens never
in query strings or Expo deep links. See [authentication.md](references/authentication.md).

### Authorization

Object-level access (IDOR), privilege checks, mass assignment / allowlist
updates. Authn + authz **inside** every Server Action and exported handler —
Next middleware or a layout alone is not enough. See
[authorization.md](references/authorization.md).

### Injection

Parameterized queries / ORM binds; never string-interpolate SQL, NoSQL filters,
GraphQL documents, templates, or shell. No `exec` / `spawn({ shell: true })` /
`Bun.$` with user-influenced strings. See [injection.md](references/injection.md).

### CSRF

Cookie-authenticated state changes: SameSite=Lax plus a `Sec-Fetch-Site` /
`Origin` check first; tokens for legacy and non-browser clients. Server Actions
check Origin automatically; custom Route Handlers don’t. Not CORS. See
[csrf.md](references/csrf.md).

### Secrets and client leak

`NEXT_PUBLIC_*` / `VITE_*` / `EXPO_PUBLIC_*` ship to the client — secrets never
use those prefixes. Tokens: httpOnly Secure cookies; else short-lived web storage
(XSS risk); native SecureStore — not AsyncStorage. See
[data-protection.md](references/data-protection.md).

### Supply chain

Install CI/prod from the committed lockfile; treat install scripts as execution
only when this manager will run them (npm `allowScripts`, pnpm `allowBuilds`, Bun
default allowlist or `trustedDependencies`, Yarn `enableScripts` /
`dependenciesMeta`); delay brand-new versions (pnpm `minimumReleaseAge`); publish
via trusted publishing + provenance; run the repo’s dependency audit. If anything
is uncertain, ask. See [supply-chain.md](references/supply-chain.md).

### Other trust boundaries

- **API edge:** runtime schema (types/casts are not enough), rate limits, response field filtering — not IDOR or CORS ([api-security.md](references/api-security.md))
- **XSS:** JSX text is escaped — don’t flag it; flag `dangerouslySetInnerHTML` and user-controlled `href`/`src`/`action` ([xss.md](references/xss.md))
- **SSRF:** user-controlled URL into `fetch` or a redirect → allowlist scheme/host; server-configured base URLs are fine ([ssrf.md](references/ssrf.md))
- **Files:** check upload type/size; resolve user paths under an allowlisted root ([file-security.md](references/file-security.md))
- **Docker:** digest-pinned base, minimal non-root runtime, BuildKit secret mounts, SBOM + provenance ([docker.md](references/docker.md))
- **Misconfiguration:** CORS allowlist, security headers, nonce-based CSP, Trusted Types report-only first, no debug leaks ([misconfiguration.md](references/misconfiguration.md))
- **Prototype pollution:** deep-merge skips `__proto__` / `constructor` / `prototype`; prefer null-prototype objects or `Map` ([prototype-pollution.md](references/prototype-pollution.md))
- **DOM clobbering:** untrusted `id`/`name` shadow `document` APIs — use `window.*`, strip those attributes ([dom-clobbering.md](references/dom-clobbering.md))
- **WebSocket:** origin allowlist, auth before actions, validated messages, no query-string tokens ([websocket.md](references/websocket.md))
- **LLM prompt injection:** delimit untrusted content, never follow its instructions, validate output shape ([llm-prompt-injection.md](references/llm-prompt-injection.md))

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

1. Detect Write vs Audit from the user ask; open only the matching Practice areas ref.
2. **Write:** implement or harden against Core Concepts and Common mistakes; skip the report template unless the user asks for a review write-up.
3. **Audit:** confirm each finding with Audit confidence; report each issue once under its primary category using Output Format. If none: "No high-confidence vulnerabilities identified."

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
| Audit confidence / source → sink / attacker vs server-controlled / non-findings | [audit-method.md](references/audit-method.md) |
| Input validation / rate limits / response filtering | [api-security.md](references/api-security.md) |
| Passkeys / WebAuthn / Argon2id / bcrypt rehash / NIST password policy / JWT / `__Host-` session cookies / token transport / Expo deep links | [authentication.md](references/authentication.md) |
| IDOR / privilege / mass assignment / authorization inside Server Actions / Next middleware limits | [authorization.md](references/authorization.md) |
| SQL / NoSQL / GraphQL / template / command injection (incl. Bun) | [injection.md](references/injection.md) |
| SSRF / open redirects | [ssrf.md](references/ssrf.md) |
| XSS sinks / URL attributes / Trusted Types | [xss.md](references/xss.md) |
| CSRF / `Sec-Fetch-Site` / Origin check / Server Actions `allowedOrigins` / Route Handlers / tokens / SameSite | [csrf.md](references/csrf.md) |
| Secrets / public env / token storage / logs | [data-protection.md](references/data-protection.md) |
| Uploads / path traversal | [file-security.md](references/file-security.md) |
| Dockerfile / digest pinning / distroless / non-root / BuildKit secrets / SBOM / provenance / `.dockerignore` | [docker.md](references/docker.md) |
| Lockfile / dependency audit / install scripts / allowScripts / trustedDependencies / allowBuilds / minimumReleaseAge / trusted publishing / provenance | [supply-chain.md](references/supply-chain.md) |
| CORS / headers / production errors / CSP nonce / `'strict-dynamic'` / Trusted Types | [misconfiguration.md](references/misconfiguration.md) |
| Prototype pollution / deep merge | [prototype-pollution.md](references/prototype-pollution.md) |
| DOM clobbering via `id` / `name` | [dom-clobbering.md](references/dom-clobbering.md) |
| WebSocket origin / auth / CSWSH | [websocket.md](references/websocket.md) |
| LLM prompt injection | [llm-prompt-injection.md](references/llm-prompt-injection.md) |
