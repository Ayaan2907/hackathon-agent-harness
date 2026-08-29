# Outside

A review council you can ask about your codebase — or deliberately without it.

Built for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge).
The agent runs on [TrueForge](https://trueforge.dev): real sandboxed execution, real
subagents, and a human approval gate that blocks an irreversible write.

> **Primary track: Best Use of TrueForge.** The console is also the answer to Best UI —
> it shows what the agent is doing, what it is waiting on, and what it did.

## What it does

You pick reviewer personas, choose a scope, and ask a question.

- **This repo** — the agent gets a Daytona sandbox, clones the repository, reads the
  files that bear on your question, and cites them.
- **Plan only** — the agent gets no sandbox and no MCP servers. It cannot read your
  code or write anything, because it has no tools that could.

Each persona answers as its own subagent on a single turn. When the council reaches a
decision, it calls `record_decision` to append to a ledger on disk — and **stops**. The
write does not happen until a human approves it in the console.

## Why the scope toggle is real

The toggle is not a sentence in a prompt. It builds a different agent spec:

| | This repo | Plan only |
|---|---|---|
| `config.sandbox.enabled` | `true` | `false` |
| `mcp_servers` | ledger, gated | `[]` |
| Can read your code | yes | no tools to do it |
| Can write anything | only via approval | no |

`lib/council/spec.test.ts` asserts this rather than trusting it.

## How the harness is used

| Feature | Where |
|---|---|
| Sessions | one per ask, inline agent spec chosen by scope |
| Subagents | one per persona, all on one turn — split by `thread_id` |
| Sandbox | Daytona; repo scope clones and reads the repository |
| MCP | this app serves its own server at `/api/mcp` |
| Approvals | `record_decision` gated by literal name; resumed with `user.tool_approval` |
| Streaming | one SSE stream, proxied through `/api/council` |

**One turn, one stream, N voices.** Subagents stream live — the "only summaries reach
the root" rule is about the root agent's *context*, not the client's event stream.
Every event carries a `thread_id`, so one connection separates the voices into
columns. N sessions would have meant N sandboxes and would have hit the browser's
per-origin connection cap for nothing.

**The approval gate lives in this repo on purpose.** `require_approval_for_tools` is a
per-MCP-server field, so built-in sandbox and file tools cannot be gated at all. This
app serves one genuinely irreversible tool and gates it by literal name, which does not
depend on the transport inferring a write annotation. Clone this, run TrueForge, and
the gate works with no manual setup.

## Run it

```bash
npx @truefoundry/trueforge          # harness on :8790
```

In the TrueForge console at `localhost:8790`, configure a model provider and a Daytona
sandbox provider. Then:

```bash
bun install
bun run dev                          # app on :3000
```

The app registers its own MCP server with the harness on the first repo-scope ask.
`.env.example` documents the two variables; both have working defaults, and the app
boots and renders with the file entirely unset.

## Repo layout

```
app/api/council/    proxies asks and approval resumes; streams SSE to the browser
app/api/mcp/        the MCP server holding the approval-gated ledger tool
lib/council/spec.ts builds the agent spec — this is where the scope toggle is real
profiles/           persona packs as SKILL.md + profile.yaml
docs/ARCHITECTURE.md what was verified against the running harness, and what bit us
```

## Qodo Code Review Evidence

Qodo reviews every pull request in this repo. Config: [`.pr_agent.toml`](.pr_agent.toml).

**Representative PR: [#6 — wire streamed council sessions through an approval-gated ledger](https://github.com/Ayaan2907/hackathon-agent-harness/pull/6).**

Qodo found five bugs, two of them security holes we would have shipped: `POST /api/mcp`
had no authentication, so any HTTP client could call `record_decision` and append to the
ledger **without passing the approval gate** — the gate governs how TrueForge invokes the
tool, not the route itself — and the MCP registration URL was built from the
caller-controlled `Host` header, which would have persisted an attacker's server under our
name. We fixed all five and dismissed none; the SSE parser fix was rewritten test-first
after Qodo pointed out that a dropped frame means `tool.approval_required` never arrives
and the gated write can never be authorised.

| PR | What Qodo reviewed | Outcome |
|---|---|---|
| [#1](https://github.com/Ayaan2907/hackathon-agent-harness/pull/1) | Scaffold, CI, open-source floor | Reviewed |
| [#6](https://github.com/Ayaan2907/hackathon-agent-harness/pull/6) | Council streaming, MCP ledger, approval gate | 5 bugs, all fixed — [decision record](https://github.com/Ayaan2907/hackathon-agent-harness/pull/6#issuecomment-5465144811) |
| [#7](https://github.com/Ayaan2907/hackathon-agent-harness/pull/7) | Multi-turn sessions, canvas plan | Reviewed |

The five review threads on #6 are resolved against the pushed fixes, and Qodo re-reviewed
the branch after them.

## Honest limits

- Persona packs ship as agent instructions, not TrueForge skills. Skills require
  `config.sandbox.enabled`, so a skill-backed persona would be silently dropped in
  plan-only scope and the toggle would compare two different voices.
- The jobs rail renders from fixtures. Growing a persona from a scraped URL is not
  wired: the configured Bright Data MCP server returns 401 and lists no tools.
- No fine-tunes. Personas are a model FQN, a temperature, and a written brief.

## License

MIT
