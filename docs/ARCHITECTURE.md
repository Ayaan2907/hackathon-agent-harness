# Architecture

## 1. Shape

Three processes, one of which we wrote.

```
┌─────────────────┐        ┌──────────────────────────┐        ┌────────────┐
│  Console        │  HTTP  │  TrueForge harness       │  MCP   │ Bright Data│
│  (this repo)    │───────▶│  :8790                   │───────▶│ (public web)│
│  Next.js 15     │  SSE   │  sessions · turns ·      │        └────────────┘
│                 │◀───────│  skills · subagents      │        ┌────────────┐
└─────────────────┘        │  approvals · sandbox     │───────▶│  Daytona   │
                           └──────────────────────────┘        │  (sandbox) │
                                        │                      └────────────┘
                                        ▼
                                   OpenAI models
```

The console holds no provider credentials. Bright Data, Daytona, and the model
provider are configured _inside_ TrueForge; the console only knows
`TRUEFORGE_BASE_URL`. That is a deliberate boundary. The blast radius of this
repo leaking is a URL.

## 2. Code layout

| Path                | Holds                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `app/`              | Routes. `page.tsx` is the server half, `XClient.tsx` the `'use client'` half, `_components/` shared UI. |
| `lib/config/env.ts` | The only place `process.env` is read. Zod-validated, all defaults, boots with zero secrets.             |
| `lib/harness/`      | The only place that talks to TrueForge.                                                                 |
| `lib/council/`      | Personas, scopes, job state. Pure functions, one export per file.                                       |
| `agents/`           | TrueForge agent specs as JSON.                                                                          |
| `profiles/`         | Persona packs.                                                                                          |

No barrel files. Import the exact module.

## 3. The verified TrueForge API

Everything in this section was checked against `@truefoundry/trueforge@0.1.4`
running locally on 2026-08-29, either by reading the shipped sources or by
calling the live server. **Three claims in the original handoff brief turned out
to be wrong, and they are corrected below.**

### Base path

The API is under **`/api/v1`**, not `/api`. Liveness is `/healthz` (unprefixed).
Interactive docs are at `/api/v1/docs`, machine-readable at
`/api/v1/openapi.json`.

### Client

Use the official SDK rather than hand-rolling fetch:

```ts
import { TrueForge } from '@truefoundry/trueforge-sdk';
const harness = new TrueForge({ baseUrl: 'http://localhost:8790' });
```

SDK `0.1.3` is the latest published and lags the server's `0.1.4`. Its route
table matches, and `agents.list()` was confirmed working against the live
server. Treat other methods as probable-but-unproven until you exercise them.

### Auth

**Local TrueForge requires no credentials.** With no OIDC issuer configured, the
server stamps every request as an admin user. `TRUEFORGE_API_KEY` is unset in
development and that is correct, not an oversight. There is no built-in API-key
scheme; when OIDC _is_ configured, the credential is an OIDC ID token.

### The turn loop

| Step                | Call                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| Create a session    | `POST /api/v1/sessions`, body `{ agent: { name } }` or `{ agent: { spec } }`   |
| Start a turn        | `POST /api/v1/sessions/{id}/turns`, body `{ input, previous_turn_id, stream }` |
| Resume a stream     | `GET /api/v1/sessions/{id}/turns/{turn_id}/subscribe?after_sequence_number=N`  |
| Read history        | `GET /api/v1/sessions/{id}/events`                                             |
| Pull a sandbox file | `GET /api/v1/sessions/{id}/turns/{turn_id}/download-sandbox-file?path=`        |

`stream` defaults to **true** and returns `text/event-stream`. Each SSE frame
carries the event JSON in `data:` and its sequence number in `id:`, so
reconnects work through either `after_sequence_number` (exclusive cursor) or the
standard `Last-Event-ID` header.

### Events

The streaming union is exactly:

```
turn.created  turn.done
model.message  model.message.delta
tool.response  tool.approval_required  tool.response_required
thread.created  thread.done
mcp.initialize  mcp.auth_required
sandbox.created
```

Subagents surface as `thread.created` / `thread.done`. Terminal turn statuses
are `running | done | cancelled | error`.

### Approvals: there is no approval endpoint

**Correction to the handoff brief.** Approving a gated tool is not a dedicated
call. You create the _next turn_ with an approval input item:

```jsonc
POST /api/v1/sessions/{id}/turns
{
  "input": [{
    "type": "user.tool_approval",
    "thread_id": "main",
    "tool_call_id": "<from the tool.approval_required event>",
    "approval": { "status": "allow" }        // or { "status": "deny", "reason": "..." }
  }]
}
```

A pending approval is detected from `turn.done` carrying a non-empty
`required_actions`, not by polling. The request schema **rejects** mixing a
`user.message` with approval items in the same turn.

### Agent spec

`model.name` is the only required field.

```jsonc
{
  "model": { "name": "openai/gpt-5-4-mini", "params": { "temperature": 0.4 } },
  "instructions": "...",
  "mcp_servers": [
    {
      "name": "bright-data",
      "enable_tools": ["@all"],
      "require_approval_for_tools": ["@write", "@destructive"],
    },
  ],
  "skills": [{ "name": "..." }],
  "config": {
    "sandbox": { "enabled": true, "file_downloads": true },
    "dynamic_sub_agents": { "enabled": true },
    "iteration_limit": 100,
  },
}
```

**Correction to the handoff brief.** `require_approval_for_tools` is a
**per-MCP-server** field, not a top-level one. It defaults to
`["@write", "@destructive"]`. Note that the approval selectors (`@all`,
`@write`, `@destructive`) are a different tag set from the enable/disable
selectors (`@all`, `@read-only`).

Agent specs are stored in SQLite at
`~/Library/Application Support/trueforge/db/db.sqlite`, not in a project
directory. There is no `.trueforge/` folder.

### Skills are git-only

**Correction to the handoff brief, and it has product consequences.** A
TrueForge skill is `{ type: "git", name, url, ref }` where `url` must be an
HTTPS GitHub or GitLab URL. `git` is the _only_ skill type. At turn time the
harness sparse-clones the repo **inside the sandbox** and tells the agent to
read `SKILL.md` itself.

The handoff asked how you register a generated skill at runtime without a
marketplace. The answer is blunt: **you cannot.** A
`SKILL.md` generated on the fly cannot become a TrueForge skill unless it is
first pushed to a public git URL.

That is why `profiles/` packs are delivered as **agent instructions**, not as
skills. It is the shortest path that actually works, and it keeps persona
switching to a per-turn decision rather than a git round-trip.

Also worth knowing: skills without a sandbox fail **silently**. A session with
`skills` set and `config.sandbox.enabled: false` returns 201 and runs fine, with
the skill simply dropped. Check `GET /api/v1/capabilities` instead of trusting
a 2xx.

### What is already configured on the dev machine

Verified present, with all credential values left unread:

- **Model provider** `openai`, serving `gpt-5.4-mini`, `gpt-5.5`, `gpt-5.6-luna`,
  `gpt-5.6-sol`, `gpt-5.6-terra`.
- **MCP server** `bright-data` → `https://mcp.brightdata.com/mcp`, authenticated.
- **Sandbox provider** `daytona`, status `ready`.
- **Agent registry: empty.** Nothing is registered yet.

## 4. Seams

The console shell renders against fixtures. Each place the harness attaches is
marked `TODO(harness)` in source:

| Seam            | File                                | Becomes                                          |
| --------------- | ----------------------------------- | ------------------------------------------------ |
| Ask the council | `app/ConsoleClient.tsx`             | `POST /sessions/{id}/turns` per selected persona |
| Stream          | `app/ConsoleClient.tsx`             | SSE consumer over the event union above          |
| Approve / deny  | `app/_components/ApprovalStrip.tsx` | next turn with a `user.tool_approval` item       |
| Persona jobs    | `lib/council/fixtures.ts`           | Bright Data scrape → pack → `origin: 'built'`    |

## 5. Why these choices

**Single Next.js app, not a monorepo.** There is one deploy target. Turborepo
plus workspaces buys nothing here and costs extra config. If a second target
appears, promote then.

**Next 15, not 16.** 16 is current, but this is a time-boxed build on a stack the
author already knows. Boring beats new when the clock is the constraint. The
upgrade is a version bump away.

**The official SDK, not hand-rolled fetch.** It ships types and stream handling.
The version skew against the server is the one real risk, which is why the wire
is documented above. If the SDK fights us, `client.fetch()` and raw routes are
right there.

**Tailwind 4, no component library.** The whole UI is a header, chips, a
textarea, a rail, and a strip. A component library would be more code, not less.

**Dark, IBM Plex, one warm accent.** The brief asked for a control room, not a
landing page. No gradients.

**Zod-validated env with defaults everywhere.** A judge who clones this repo and
runs `bun run dev` gets a working console with no `.env` file. That property is
worth more than any single feature.

**Fixtures that are not placeholders.** The fixture personas are real voices with
real stances, so a failed scrape degrades to something usable instead of an
empty state.
