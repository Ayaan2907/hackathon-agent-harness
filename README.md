# Outside

Reviewer personas, grown from public data, asked as a council on a
[TrueForge](https://trueforge.dev) session, with every write gated behind human
approval.

Built for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(TrueForge · WeMakeDevs · Bright Data · Qodo).

> **Status: scaffold.** The repo, toolchain, CI, and console shell are real and
> green. The council itself is not wired to the harness yet. Every seam is
> marked `TODO(harness)` and described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## What it does

You are mid-project and stuck. You have a chat log, or a repo, or both.

1. **Import** that context into a TrueForge session. Paste it, or point at a repo.
2. **Grow personas** from public data in the background. A URL goes in, a
   reviewer voice comes out. The job never blocks the conversation.
3. **Ask the council** in one of two scopes:
   - _This repo_. The agent reads the sandbox and cites files.
   - _Plan only_. File tools are stripped, so the answer stands on reasoning alone.
4. **Switch, rotate, compare** who is speaking.
5. When a voice wants to write something, the turn **stops for your approval**.

The last point is the one that matters. The console is built so you can see what
the agent is doing, what it is waiting on, and what it did, and so nothing
irreversible happens without a human saying yes.

## Why it is shaped this way

The interesting problem in agent products is not the model. It is the harness:
sessions that survive a reconnect, tools that stop before they bite, subagents
that report back, a sandbox that holds the blast radius. This repo tries to make
that machinery visible rather than hiding it behind a chat bubble.

## Quickstart

Requires [Bun](https://bun.sh) 1.3+ and Node 22+.

```bash
# 1. the agent runtime, serving its console and API on :8790
npx @truefoundry/trueforge

# 2. this console
bun install
bun run dev
```

It boots with **zero secrets**. Model, scraping, and sandbox credentials are
configured inside TrueForge, not here. This app never holds them. Configure
them once at http://localhost:8790 and everything downstream picks them up.

Register the council agent:

```bash
curl -X POST http://localhost:8790/api/v1/agents \
  -H 'content-type: application/json' \
  -d @agents/council.agent.json
```

## Repo layout

```
app/            Next.js App Router. page.tsx (server) + XClient.tsx (client),
                _components/ for shared UI, __tests__ colocated.
lib/            Domain logic, one exported function per file.
                lib/config/env.ts is the only place process.env is read.
                lib/harness/  is the only place that talks to TrueForge.
agents/         TrueForge agent specs.
profiles/       Persona packs. SKILL.md + profile.yaml per voice.
docs/           Architecture, agent design, and verified harness API notes.
```

## Sponsor stack

| Sponsor         | What it actually does here                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **TrueForge**   | The runtime. Sessions, turns, streaming events, subagents, sandbox-as-tool, and per-server tool approval. |
| **Bright Data** | Configured as an MCP server on the harness. Scrapes public pages that personas are grown from.            |
| **Daytona**     | The sandbox provider. Repo clones and generated scripts run there, not on the host.                       |
| **Qodo**        | How this repo is developed. See below.                                                                    |
| **OpenAI**      | The model provider, configured inside TrueForge.                                                          |

## Qodo Code Review Evidence

Every substantive change lands through a pull request reviewed by
[Qodo](https://www.qodo.ai) before a human merges it. Configuration lives in
[`.pr_agent.toml`](.pr_agent.toml): `/agentic_describe` and `/agentic_review`
run automatically on each PR, inline findings are surfaced at Medium severity
and above, and the review guidelines point Qodo at this project's real risk:
ungated write tools, unvalidated scraped content, and stray secrets.

- Representative merged PR: _pending, first review lands with the scaffold PR_
- What Qodo surfaced, and what we changed or dismissed: _pending_

Every High-severity finding is either fixed or dismissed in the Qodo thread with
a written reason.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). How the pieces fit, the verified
  TrueForge API, and why each stack choice was made.
- [docs/AGENT.md](docs/AGENT.md). The council agent's job, tools, and approval gate.
- [CONTRIBUTING.md](CONTRIBUTING.md). Setup, conventions, review bar.
- [SECURITY.md](SECURITY.md). The three sharp edges of an agent that reads the
  web and executes tools.

## License

MIT. See [LICENSE](LICENSE).
