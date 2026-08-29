# The council agent

One agent, many voices. A persona is a set of instructions layered onto the same
runtime, not a separate agent, and not a TrueForge skill (skills are git-only;
see [ARCHITECTURE.md](ARCHITECTURE.md#skills-are-git-only)).

Spec: [`agents/council.agent.json`](../agents/council.agent.json).

## Job

Answer a question about work in progress, in the voice of a selected reviewer
persona, under one of two scopes.

| Scope  | Tools                 | Answer must                           |
| ------ | --------------------- | ------------------------------------- |
| `repo` | sandbox file tools on | cite specific files it read           |
| `plan` | file tools off        | stand on reasoning; no file citations |

The scope is not a prompt suggestion. In `plan` scope the file tools are not
offered to the model, so a plan-only answer cannot quietly read the codebase.

## Tools

| Tool source       | Use                                      | Approval                         |
| ----------------- | ---------------------------------------- | -------------------------------- |
| Sandbox (Daytona) | clone a repo, read files, run a script   | reads free, writes gated         |
| `bright-data` MCP | fetch a public page for persona building | gated on `@write`/`@destructive` |

Approval is configured per MCP server via `mcp_servers[].require_approval_for_tools`,
defaulting to `["@write", "@destructive"]`.

## Subagents

`config.dynamic_sub_agents.enabled` is on. One level deep. Each subagent shows
in the stream as `thread.created` → `thread.done`, and only its final result
reaches the root thread. Comparing two personas is the natural use: fan out,
collect, show side by side.

## The approval gate

The demo turns on this. When a persona proposes a write:

1. Harness emits `tool.approval_required` with a `tool_call_id`.
2. The turn parks; `turn.done` carries a non-empty `required_actions`.
3. The console shows the approval strip: tool name, what it will do, approve or deny.
4. A human answers. The console creates the **next turn** with a
   `user.tool_approval` item. There is no approval endpoint.

Nothing irreversible happens between steps 1 and 4. That is the whole point.

## Events the console renders

```
turn.created            turn is live
model.message.delta     streaming text
thread.created/done     a subagent came and went
tool.approval_required  stop and ask
sandbox.created         the sandbox is up
turn.done               with required_actions if something is waiting
```

Reconnect with `?after_sequence_number=N` or the `Last-Event-ID` header. The
sequence number arrives as the SSE `id:` field on every frame.

## Open design questions

Decide these with evidence, not by inventing APIs.

1. Is a council of N personas N subagents in one turn, or N sequential turns?
   Subagents give one stream and one place to approve; sequential turns give
   cleaner per-persona history.
2. Does switching personas fork the session or continue it? Continuing keeps
   context; forking makes compare honest.
3. What does "memory" mean past the session and its sandbox files? For the
   hackathon slice, probably nothing more.
