# Harbor Mutual Floor — agent intent

Do not expand this until Wing Mic is attached. This file exists so PR 0 is not README-only.

## Agent

- Name: `harbor-mutual-claims`
- Job: Investigate claim `HM-2847`. Recommend a reserve. Stop for supervisor approval.
- Gated tool: `reserve_claim` via MCP `require_approval_for_tools`
- Read tools: `get_claim`, `get_policy`, `list_prior_claims`
- Subagents: policy language, weather at loss, prior VIN claims
- Sandbox: timestamp-reconcile script (Daytona, sandbox-as-tool)

## Events the Floor UI must render

From https://trueforge.dev/api/use-agent :

- `thread.created` / `thread.done`
- `tool.approval_required` → resume with `user.tool_approval`
- `turn.done` with `required_actions`
- SSE subscribe with `after_sequence_number` for reconnect
