# AGENTS.md

Conventions live in [CLAUDE.md](CLAUDE.md). This file records only the
non-obvious things about running this project in a fresh environment.

## Toolchain

Bun 1.3.10, pinned in three places that must agree: `.bun-version`,
`packageManager` in `package.json`, and the CI `setup-bun` step (which reads
`.bun-version`). Node 22+ — TrueForge itself requires it.

## Running with no secrets

The console boots with zero configuration. `lib/config/env.ts` gives every
variable a working default, and empty strings are stripped so a half-filled
`.env` behaves like an empty one. `TRUEFORGE_BASE_URL` defaults to
`http://localhost:8790`.

Provider credentials — Bright Data, Daytona, OpenAI — are **not** this app's
concern. They are configured inside the TrueForge harness and never appear in
this repo's environment.

## The harness is a separate process

Nothing works end to end without it:

```bash
npx @truefoundry/trueforge     # :8790, local mode, SQLite
```

Local TrueForge runs with **authentication off** — with no OIDC issuer
configured it treats every caller as admin. An unset `TRUEFORGE_API_KEY` is
correct in development.

Its state lives in `~/Library/Application Support/trueforge/db/db.sqlite`, not in
this repo. There is no `.trueforge/` project directory. Registered agents,
configured MCP servers, and sandbox providers survive across clones of this repo
and are invisible to `git status` — if something works on your machine and not in
CI, this is why.

## Health checks

```bash
curl http://localhost:8790/healthz            # harness liveness
curl http://localhost:8790/api/v1/capabilities # is sandbox/skills actually usable
curl http://localhost:8790/api/v1/agents       # what is registered
```

`/api/v1/capabilities` matters: skills configured without a working sandbox fail
**silently**, returning 201 and then dropping the skill. A 2xx does not mean it
ran.

## API surface

Routes are under `/api/v1`, not `/api`. Full verified surface, including the
approval flow and three corrections to the original brief, is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#3-verified-trueforge-api-surface).
