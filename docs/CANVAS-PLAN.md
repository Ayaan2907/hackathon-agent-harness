# Canvas plan — task breakdown

Where Outside goes next: a canvas of session windows you can ask a council over,
flipping between your own agent and personas built from public data.

Written to be dispatched. Tasks inside a track are sequential; tracks are
independent and can run in parallel worktrees. Each task names its **seam** —
the public boundary its tests sit on — because that is the thing to agree before
any test gets written.

## Corrections this plan is built on

Verified against the running harness, not the docs. Get these wrong and the data
model goes wrong with them.

**Session → Turn → Thread.** A *session* is the conversation. A *turn* is one
question and its whole answer. A *thread* is an execution lane inside a turn:
`main`, plus one per subagent. So a canvas window is a **session**, each message
is a **turn**, and the council voices are **threads inside one turn** — not
separate chats.

**A session is bound to its agent spec at creation.** Scope and council
membership live in that spec, so changing either cannot re-scope a live session.
It forks. `planTurn` already encodes this.

**There is no assistant role on import.** `InitialUserMessage` accepts exactly
`{"type":"user.message","content":"..."}`. An imported conversation collapses
into one seeded user message. Import is a *summarisation* feature, not a
*continuation* one — do not let the UI imply otherwise.

**Sandboxes cannot be imported.** Daytona sandboxes are provisioned per session
and auto-stop at 5 minutes. "Import my sandbox" is really "clone this repo into
a fresh one", which already works.

**Not OpenUI.** OpenUI is a generative-UI toolkit — it makes an agent respond
*with* UI. It is not a canvas and will not give you pan, zoom, or windows. Use
tldraw. TrueForge also already has `generative_ui` enabled, so adding OpenUI
would stack a second generative-UI layer on one we have.

## Track 0 — foundation (this PR)

| Task | Seam | State |
|---|---|---|
| 0.1 Multi-turn session continuity | `planTurn` — pure decision, 5 tests | **done** |

Follow-ups it exposes, both small and worth doing before the canvas:

- **0.2 Transcript state.** The display resets each turn; only the agent keeps
  context. A window needs turn history. *Seam:* a reducer over turns, tested
  without the network.
- **0.3 Approval identity.** The gate can fire on `main` or on a subagent
  thread — Cursor's run saw a subagent, mine saw `main`. Both work today, but
  with several windows the strip must say *which* window is waiting.
  *Seam:* the pending-approval selector.

## Track A — canvas shell

Independent of the harness. Can start immediately, in parallel with everything.

- **A.1 Canvas surface.** tldraw with one custom shape: a session window with a
  title bar, body, and close control. Pan, zoom, add, remove, persist layout to
  localStorage. No harness calls at all.
  *Seam:* the layout store — add/move/remove/persist — tested headlessly.
- **A.2 Floating command bar.** The October-style bar pinned over the canvas,
  routing a typed question to the focused window, with a visible target so it is
  never ambiguous which window receives it.
  *Seam:* focus resolution — which window is targeted given selection state.

Do not wire A to the harness. Track B does that, and keeping them apart is what
lets both run at once.

## Track B — sessions as first-class

Depends on 0.1.

- **B.1 Session list and resume.** `GET /api/v1/sessions` to list,
  `GET /api/v1/sessions/{id}/events` to rehydrate. Reopening a window restores
  its conversation instead of starting over.
  *Seam:* the event-log → transcript projection. Pure, fed by a captured
  fixture — there are real SSE captures to use.
- **B.2 One stream per window.** Several windows streaming at once. Each window
  is its own session, so this is where the browser's ~6-connection cap per
  origin becomes real under HTTP/1.1 `next dev`.
  *Seam:* the connection pool — cap concurrent streams and queue the rest.
  **Test the cap**; this is the failure that looks like "one window never
  starts".

## Track C — personas as TrueForge agents

Independent of A and B.

- **C.1 Persona CRUD.** `POST /api/v1/agents`, `PUT`, `DELETE` all exist. Each
  persona becomes a saved agent; `profiles/` seeds them on first run.
  *Seam:* the profile → agent-manifest mapping. Pure.
- **C.2 Fork on flip.** Changing a window's persona creates a new session bound
  to the new agent, preserving the old one. Extends `planTurn` with an
  `agentId` term.
  *Seam:* `planTurn` again — add cases, do not add a second decision function.

Note: personas currently ship as *instructions*, not skills, because skills
require `config.sandbox.enabled` and would be silently dropped in plan-only
scope. Moving to saved agents does not change that — a plan-only agent still
cannot carry a skill.

## Track D — import

Independent.

- **D.1 Claude Code import.** Sessions live at
  `~/.claude/projects/<path-slug>/<session-uuid>.jsonl`, one JSON record per
  line, with `type` of `user`, `assistant`, `attachment`, `last-prompt` and
  others. Parse, flatten to a transcript, seed one `user.message`.
  *Seam:* the JSONL → seed-message transform. Pure, fixture-driven. **Include a
  malformed-line fixture** — these files are appended live and the last line can
  be a partial write.
- **D.2 Paste import.** A textarea that accepts markdown and does the same
  flattening. Ship this first if D.1 slips; it is the fallback the brief
  already allows.

Cursor import is explicitly **not** in scope: its history is in an undocumented
SQLite database and is version-fragile.

## Track E — Bright Data repair

Independent, small, and currently blocking every scraping story.

- **E.1 Fix auth.** `GET /api/v1/mcp-servers/bright-data/tools` returns
  **401 Unauthorized**. The manifest stores a raw token under `Authorization`;
  Bright Data's MCP expects `Bearer <token>`. One field in the harness console.
  *Acceptance:* that endpoint lists tools instead of erroring.
- **E.2 Persona from URL.** Only after E.1. Scrape a public profile, generate a
  brief, land it as a persona.
  *Seam:* the scrape → brief transform.
  **Scraped text must not go straight into `instructions`** — that is untrusted
  web content becoming a system prompt, which this repo's own `.pr_agent.toml`
  guidelines flag. Require a human edit step before attach.

## Suggested parallelism

Three worktrees, no shared files:

1. **A.1 → A.2** — canvas, pure frontend
2. **B.1 → B.2** — sessions, touches `lib/council` and the route
3. **C.1 → C.2** or **D.2 → D.1** — personas or import

E.1 is fifteen minutes and unblocks a whole track; do it before dispatching E.2.

The collision risk is B and C both editing `planTurn`. Land B.1 first, or have C
extend the tested function rather than fork it.
