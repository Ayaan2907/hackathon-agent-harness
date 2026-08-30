# UX design — Outside

What the product should be on screen, and what should stop existing. Written
after reading `app/ConsoleClient.tsx`, `app/_components/*`, `app/canvas/**`,
`lib/council/*`, `lib/canvas/*`, `app/api/*`, `docs/ARCHITECTURE.md` and
`docs/CANVAS-PLAN.md` on 2026-08-29.

This is a design document. It prescribes; it does not implement. Where a claim
about the current code matters, the file is named so it can be checked.

## The vocabulary, fixed

Everything below uses these words and only these words. The UI should use them
too, in copy and in code.

- **Session** — one conversation, bound to one agent spec. A scope and a council
  are part of that spec, so neither can change inside a session.
- **Turn** — one question and its whole answer. An approval splits a turn in the
  harness but not for the reader: the ask that parks and the resume that
  finishes it are one turn on screen. `lib/council/transcript.ts` already folds
  it that way and calls it an exchange; rename it to turn so the code and the
  screen agree.
- **Voice** — one persona answering, as its own subagent thread. Never "thread"
  in user-facing copy. Never "agent" either; the user does not care that a voice
  is a subagent.
- **Fork** — a new session, because the scope or the council changed.
- **Ledger** — the append-only record of decisions. The only thing this product
  writes.

---

## 1. One primary surface: the console

**Decision: the console is the product. The canvas is deleted.**

Both surfaces exist today and neither links to the other — `grep` finds no
`next/link` and no anchor anywhere in `app/`, so `/canvas` is reachable only by
typing the URL. That is not two products serving two jobs. That is one product
and one prototype that never got a front door.

### The case for the canvas, taken seriously

The canvas has a real argument behind it. Its central noun is right: a window is
a session, which matches the data model exactly, and it makes the one comparison
this product exists for physically visible — the same question asked at repo
scope and at plan-only scope, side by side. `lib/canvas/focus.ts` is a genuinely
good piece of thinking: it refuses to send a question when the target is
ambiguous, which is the failure a floating command bar over a plane of windows
would otherwise have shipped with. The canvas is also the better-looking surface
today, and that is not nothing.

### Why it still loses

1. **An infinite plane cannot guarantee a viewport, and the approval gate needs
   one.** The product's claim is that nothing irreversible happens without a
   human decision. On a pannable, zoomable canvas, "the parked write is
   off-screen" is a state the interface cannot prevent — the user can always be
   looking somewhere else. The fix is a pinned global alert that lives outside
   the canvas, at which point the canvas is paying the cost and fixed chrome is
   carrying the value. A surface that has to be rescued by non-canvas chrome for
   its most important moment is not the right surface.

2. **The content is long prose, and a canvas is a bad prose reader.** A council
   answer is several hundred words per voice, streaming. The default window is
   340×240 (`CanvasBoard.tsx`, `NEW_WINDOW_SIZE`). Every window must be resized
   before it can be read, and the user does that work once per window, forever.
   A column of text needs a column, not a box you drag.

3. **The audience does not want a workspace.** Spatial canvases pay off when a
   user curates the same board across weeks and the relationships between
   objects carry meaning. This user is mid-project, stuck, impatient, and here
   for one decision. The sandbox behind a session auto-stops after five minutes.
   Nothing here lives long enough to be worth arranging.

4. **The wiring cost is not a hackathon-sized cost.** The canvas holds local
   strings (`SessionWindowShapeUtil` props: `messages: string[]`). Making it
   real means putting streaming voices, per-window session identity, per-window
   status, per-window approvals and scope into a tldraw custom shape, plus a
   concurrent-stream cap for the browser's ~6-connection-per-origin limit under
   HTTP/1.1 `next dev` — which `docs/CANVAS-PLAN.md` task B.2 already flags as
   "the failure that looks like one window never starts". That is days. The
   console needs hours.

5. **Two surfaces means two homes for the gate.** The gate must be everywhere or
   it is nowhere. One surface is the only way to be sure.

### What happens to the loser

Delete it, and be specific about what "delete" means:

1. Remove `app/canvas/` entirely — `page.tsx`, `CanvasClient.tsx`,
   `_components/CanvasBoard.tsx`, `_components/CommandBar.tsx`,
   `_components/SessionWindowShapeUtil.tsx`, `_components/canvas.css`.
2. Remove `lib/canvas/layout.ts`, `lib/canvas/focus.ts` and both test files.
   Focus resolution only exists because a floating bar over a plane made
   targeting ambiguous. In the console the target is the one conversation on
   screen, so the question does not arise and the answer should not be kept.
3. Drop `tldraw` from `package.json` — currently `^5.3.2`, the largest
   dependency in the project by a wide margin, on a surface with no entry point.
4. The work stays recoverable on the `feat/canvas` branch. Nothing is lost; it
   is parked.

The one idea worth rescuing is comparison. It comes back in section 8 as a
bounded two-pane compare, not an infinite plane. Two panes give the whole
benefit — the same question under both scopes, readable side by side — with none
of the cost, because two fixed panes always have a viewport and always have room
for the gate.

If the owner overrules this and keeps the canvas, the minimum it must do before
it can ship is: a pinned approval bar outside the canvas that pans the viewport
to the parked window when clicked, a hard cap on concurrent streams with a
visible queue, and a per-window scope badge. That is the honest price.

---

## 2. Information architecture

The console is confusing because it is a flat list of eight peers. Header,
scope, personas, question box, submit, conversation, session list, jobs rail,
import panel, approval strip — nothing is subordinate to anything else, so the
eye has no entry point. The fix is not rearrangement. It is deletion plus three
zones.

### Three zones, and nothing else

**Top bar (fixed, thin).** Product name. The current scope, stated loudly (see
section 6). The session's identity, which doubles as the way into history. One
status word. That is all. It is a status bar, not a toolbar.

**Centre column (the only thing that scrolls).** The conversation, turn by turn,
oldest at top. Maximum reading width around 72ch. Everything else on the screen
is fixed; this is the one region with a scrollbar, so "scrolled away" is a state
only the transcript can be in.

**Composer (pinned to the bottom).** Scope, council chips, question, ask button.
Pinned, because the user's hands and eyes return here between every turn, and
because the approval strip takes this exact position when a write parks. The
place you look to act is the same place, always.

### What is removed entirely

1. **The jobs rail.** `app/_components/JobsRail.tsx`, `FIXTURE_JOBS`, the `Job`
   and `JobState` types in `lib/council/types.ts`, `lib/council/job-state.ts`
   and its test. This is theatre and it is the clearest example of it: the array
   is always empty, so the only string a user has ever seen from this component
   is "No persona builds running. Point one at a public URL and it grows in the
   background." That sentence promises a feature with no interface to start it,
   built on a Bright Data integration that returns 401. It is a rail whose only
   job is to describe a lie. Cutting it frees the entire right-hand column.

2. **The right-hand aside.** With the jobs rail gone, only the session list is
   left in it, and a 288px permanent column for a list the user touches once a
   day is not a trade worth making. Sessions move behind the session name in the
   top bar.

3. **The "built" badge on `PersonaChip`.** No interface can create a persona with
   `origin: 'built'` — `POST /api/personas` exists and has zero callers in
   `app/`. It is a badge for a state no user can reach. Restore it when there is
   a way to make one.

4. **The import panel as a permanently mounted page section.** Detail in the
   next list.

### What moves, and where

1. **Sessions → a menu on the session name in the top bar.** The top bar shows
   the current session's title, or "New conversation" when there is none. Click
   it, get the last 25. Reopening is rare, and today it is also read-only — see
   section 7, flow 6 — so it does not deserve permanent screen area.

2. **Import → an action inside the composer.** Today `ImportPanel` is a
   permanent block at the bottom of `/` (mounted in `app/page.tsx` next to
   `ConsoleClient`) that ends by asking the user to click "Copy seed", click into
   the ask box, and paste. The app has the seed text in a variable and is making
   the user carry it across the screen by hand. Replace it: an "Attach a
   conversation" control in the composer opens a small panel, parses, and writes
   the seed straight into the question textarea, where the user can edit it
   before asking. Same `POST /api/import`, same parsers, three fewer actions and
   a page section removed.

   Keep the honest sentence the panel already has — that an import is quoted,
   not resumed — but say it in one line at the point of attachment, not in a
   four-line paragraph on the main screen.

3. **The root thread's delegation narration → the activity line.** Today it is a
   collapsed `<details>` labelled "root thread — delegation" sitting between the
   question and the voices. It is genuinely useful content in exactly the wrong
   shape: it is _what the agent is doing_, and it is presented as a footnote. See
   section 3.

### What stays on screen at rest

At rest — nothing asked yet — the screen holds: the top bar, an empty
transcript area with one sentence of orientation, and the composer with the
scope control, the council chips, and the question box focused. Roughly a
quarter of what is there today.

The empty state should not say "Nothing yet." It should say what the two scopes
do, because that choice is the first thing the user has to make and the only
thing they cannot infer. Detail in flow 1.

---

## 3. The three states

### What it is doing

**Where it lives:** one line, directly under the question of the newest turn,
inside the transcript. Not in the chrome. The activity belongs to the turn it
belongs to, and stays there afterwards as a record of how that answer was
produced.

**What it says:** plain sentences built from events that already arrive on the
stream.

| Event                    | Line                         |
| ------------------------ | ---------------------------- |
| `turn.created`           | Starting                     |
| `sandbox.created`        | Sandbox up, cloning the repo |
| `thread.created`         | Hostile Reviewer started     |
| `model.message.delta`    | Hostile Reviewer is writing  |
| `thread.done`            | Hostile Reviewer finished    |
| `tool.approval_required` | Waiting on you               |
| `turn.done`              | Done, or the error           |

One line, replaced in place, with the previous steps available by expanding it —
which is where the root thread's delegation narration goes. The default is one
line; the history is one click away.

**The gap this closes.** `reduceTranscript` ignores `sandbox.created`
completely. At repo scope the first thirty to sixty seconds of every turn are
sandbox provisioning and `git clone`, during which the console shows the word
"working" and an empty transcript and nothing else. That silence is, I think,
the single largest contributor to the console feeling confusing at repo scope:
the user cannot tell a slow clone from a hung request. Reducing
`sandbox.created` into the transcript and showing it costs a case in a switch
statement.

**In the top bar:** the same state, one word, so it is legible when the user has
scrolled. One vocabulary for both, and one only. Today there are two — the
header uses idle / working / waiting on you / done / error, and each voice
separately uses thinking / done. Pick one set:

`waiting on you` · `working` · `done` · `failed`

Drop `idle` from the vocabulary entirely. At rest the status slot shows the
scope and the council instead, because "idle" is a word for the machine, not a
word for the person.

### What it is waiting on

**Where it lives:** the composer position, replaced. Full detail in section 4.

The current strip is the last child of a `flex min-h-screen flex-col` and is not
fixed or sticky, so with a long transcript it sits at the bottom of the document
and the user has to scroll to find the thing that is blocking their turn. For
the highest-stakes interaction in the product, that is the wrong default and it
should be treated as a defect, not a polish item.

### What it did

**Where it lives:** two places, both durable.

1. **The transcript** — every turn stays on screen, with its question, its
   scope, its voices, and its outcome. This mostly works today.

2. **The ledger, which is currently invisible.** The whole product narrows to
   one act: a write that a human approved. `record_decision` appends to
   `.outside/decisions.jsonl` and the console never mentions it again. After
   clicking Approve, the user has no confirmation that anything landed, no way
   to see what was written, and no way to read back the decisions from earlier
   in the day.

   Add a read-only ledger view: a `GET /api/ledger` that reads the jsonl file,
   and two surfaces for it — an inline confirmation in the turn where the write
   was approved ("Recorded: <decision>"), and a count in the top bar that opens
   the full list. The count is the product's scoreboard. "Four decisions
   recorded today" is the sentence that makes the approval gate feel like it was
   worth having, rather than an obstacle the user clicked through.

   This is cheap — one route reading a file the app already writes — and it is
   the largest missing piece of the "what it did" state.

---

## 4. The approval moment

This is the interaction the product is for. It gets designed first and cut last.

### How the user knows

Four signals, because the wait can be minutes and the user will tab away:

1. **The composer is replaced by the approval block.** Not a banner above it,
   not a toast — replaced. The composer must be disabled while parked anyway, so
   the space is free, and the user's eye already returns there between turns.
   Nothing else moves on the page.
2. **The top bar status flips to "waiting on you"** in the wait colour
   (`--color-wait`, already in the palette).
3. **The turn block gets a left border in the wait colour**, so scrolling
   through a long conversation shows which turn is parked.
4. **The document title becomes "Approve — Outside".** The tab is the only
   channel that reaches a user who has switched away, and at repo scope they
   will have switched away.

### What the block contains

For each parked voice, in the order the calls arrived:

- **The voice's name.** `pendingVoices` in `lib/council/events.ts` already
  resolves this from `thread.created`, with a short thread-id fallback for a
  rehydrated session. Keep exactly that behaviour: a fallback name is worse than
  a real name and far better than hiding an approval the turn cannot finish
  without.
- **The tool name**, quietly, in mono.
- **What it wants to write.** This is the gap. The strip currently shows only
  the tool name, and `approvalsFrom` keeps only `{ threadId, toolCallId,
toolName }` off the event. Approving a write whose contents you cannot see is
  not a decision, it is a rubber stamp with an extra click. `record_decision`
  takes `persona`, `decision`, `rationale` — three short strings, all of them
  readable. If the `tool.approval_required` event carries
  `tool_calls[].function.arguments` (it very likely does; this is standard for
  the shape, but I have not confirmed it against a captured event), parse it and
  render the decision and rationale under the voice's name. If it does not, that
  becomes the highest-priority harness question in the project, because without
  it the gate is ceremony.

Then one sentence of consequence — "This appends to the decision ledger and
cannot be undone" — and the buttons.

### Several at once

The harness rejects a partial resume: "Send batch must resolve all pending tool
calls awaiting user input." So the design constraint is not a preference, it is
the API.

1. **One decision, all calls.** Keep the current model. Do not add per-voice
   buttons — they would offer a choice the harness cannot honour, and a control
   that fails on press is worse than no control.
2. **Name every voice, always.** With three voices parked, the block lists three
   voices with three proposed entries, then one pair of buttons reading "Approve
   all 3" / "Deny all 3". The user weighs three specific proposals and makes one
   answer. That is coherent; a count of "3 calls" is not.
3. **Say why it is one decision, once, in one line** — the strip's existing copy
   already does this well and should survive the redesign nearly unchanged.
4. **Deny takes an optional reason.** `POST /api/council` already accepts
   `reason` and the UI never sends one, so every denial currently reaches the
   agent as "Declined by the supervisor." One optional input turns a denial into
   feedback the next turn can act on.

### Keyboard and focus

- When the block appears, move focus to the block's container, not to a button.
  A screen reader announces it; a stray Enter does not approve an irreversible
  write. Never put default focus on the destructive control.
- No keyboard shortcut for Approve. This is the one place in the product where
  friction is the feature.
- The current `role="alertdialog"` is wrong: nothing traps focus and the rest of
  the page stays interactive, so it is not a dialog. Use a region with
  `aria-live="assertive"` and a heading.

### The five-minute problem

Daytona sandboxes auto-stop after five minutes. A user who tabs away, gets
coffee, and comes back to approve may be resuming into a sandbox that no longer
exists. I do not know what the harness does in that case — whether the resume
turn errors, or succeeds without file tools. Two things follow regardless:

1. Show when the turn parked ("waiting since 14:32"), so a returning user knows
   they have been slow.
2. Whatever the failure is, it must surface as an explicit error in the turn,
   not as a stream that quietly stops. This needs a captured event to design
   properly; flag it as an open question, not a solved one.

---

## 5. The scope toggle

It reads as a preference because it is built as one: a two-option segmented
control in the top-right of the header, styled identically to the import
source picker in `ImportPanel`. Same size, same border, same rounded box. The
sharpest idea in the product looks like a display setting.

Six changes.

**1. Move it into the composer, next to the ask button.** Scope is not chrome.
It is part of the question — arguably the more consequential part. It belongs
where the question is written, in the user's line of sight at the moment they
commit.

**2. State the capability, not the label.** Two options, each with its
consequence written out, not hidden in a tooltip:

> **This repo** — clones and reads your code in a sandbox, cites files, can
> propose a ledger write.
>
> **Plan only** — no sandbox, no tools. It cannot read your code even if it
> tries.

That second sentence is the product's whole pitch and it currently appears
nowhere on screen. The nearest thing is a mono caption reading "no sandbox, no
write tools", set in `--color-ink-faint` at 12px next to the ask button.

**3. Make the composer visibly different in each state.** Not the same box with
a different pill selected. At repo scope the composer shows the clone target and
a ledger indicator. At plan-only scope it shows a line reading "No tools
attached", the ledger indicator disappears, and the composer's border goes to
the quiet line colour. The user should be able to tell which mode they are in
from three metres away, with the text unreadable.

**4. Name the repo. This is a correctness problem, not a styling one.**
`lib/council/spec.ts` hard-codes `REPO_URL` to
`https://github.com/Ayaan2907/hackathon-agent-harness.git` — this project's own
repository. For every user who is not the author, the control labelled "This
repo" reads a different repository than the one they are sitting in, and nothing
on screen says so. Either the control displays the clone target
(`github.com/Ayaan2907/hackathon-agent-harness`) as literal text next to the
option, or the option is renamed to what it actually does. Shipping a capability
boundary whose label is wrong undermines the exact claim the product is making.
For the hackathon, displaying the URL is enough and takes minutes.

**5. Stamp the scope on every turn, permanently.** A session is bound to its
spec, so the scope of a past answer is a fact about that answer. Each turn in the
transcript carries a small badge next to its question: "This repo" or "Plan
only". Scrolling back, the user can always tell which answers were allowed to
see the code. This also makes a fork legible after the fact.

**6. Never wipe the transcript silently.** This is the current behaviour and it
is the worst bug in the console. Change the scope, ask a follow-up, and
`useCouncilStream.ask` calls `setTranscript([])` — the conversation vanishes with
no warning and no way back. The user's model is "I flipped a switch"; the
system's model is "you started a different conversation". They are never
reconciled on screen.

Two changes fix it:

- **Warn before the fork, at the moment of the change, not at the ask.** When the
  scope or the council changes while a conversation exists, the composer shows a
  line: "Asking now starts a new conversation — this one stays in your history."
  The ask button's label changes to "Ask in a new conversation". No modal; the
  user has already made the decision, they just need to know what it means.
- **Keep the old turns on screen.** Insert a divider — "New conversation: scope
  changed to Plan only" — and render the previous turns above it, dimmed and
  read-only. The forked session is a different session; the transcript is a
  display artefact and can hold both. The user never loses what they were
  reading, and the fork becomes visible instead of destructive. `decide` reads
  `transcript.at(-1)`, so keeping older turns does not disturb the approval path.

The same warning applies to changing the council, which forks for the same reason
and today wipes the screen just as silently.

---

## 6. Flows

### Flow 1 — first run, empty state

1. The user opens `/`. The harness may or may not be running.
2. Top bar: "Outside", "New conversation", no status word.
3. The transcript area holds one short block, and its job is to make the scope
   choice, not to welcome anyone: two lines naming what each scope can and
   cannot do, and one line saying that a decision the council wants to record
   will stop and wait for approval. Three sentences. No hero copy.
4. The composer is below it, with both persona chips selected, the scope on
   "This repo", and focus already in the question box.
5. If the harness is unreachable, the composer shows one line above the ask
   button: "The harness is not responding at localhost:8790." The app is not
   broken, one dependency is missing, and the copy should say which. Today a
   harness failure surfaces as a 502 message only after the user has written a
   question and pressed the button.

### Flow 2 — ask a question

1. The user picks a scope. The composer changes appearance to match.
2. The user picks voices. Both are on by default; deselecting one is the common
   edit.
3. The user types and presses the button, or Cmd+Enter.
4. The composer's question box empties and disables. The turn appears at the
   bottom of the transcript with the question, the scope badge, and the activity
   line reading "Starting".
5. At repo scope the activity line moves to "Sandbox up, cloning the repo" and
   stays there for the clone. This is the state that currently shows nothing.
6. A voice card appears per `thread.created`, in the order the user selected
   them — stable order, so cards do not jump while streaming.
7. Text streams into each card. Cards are **stacked full width**, not in a
   two-column grid. Two long reviews in narrow columns are harder to read than
   two long reviews in sequence, and `POST /api/council` accepts up to four
   personas, which as a 2×2 grid is a wall. Each card has a header with the
   voice's name and its own state.
8. `thread.done` marks a card complete. `turn.done` sets the turn's status and
   the top bar's word.
9. The composer re-enables, focused, ready for the follow-up.

### Flow 3 — follow up

1. The user types again without touching the scope or the chips.
2. `planTurn` returns `continue`; the same session takes the turn and the agent
   keeps its context.
3. A new turn appends below the last one. Nothing is cleared. Nothing needs
   explaining, because nothing changed.
4. If the user _did_ touch the scope or the chips, the composer already shows the
   fork warning from section 5 and the button already reads "Ask in a new
   conversation". The user chose it; the divider records it.

### Flow 4 — import a conversation

1. The user clicks "Attach a conversation" in the composer.
2. A panel opens with two sources — Paste, Claude Code — a file picker, and a
   textarea.
3. The user pastes, or picks a `.jsonl`. `POST /api/import` parses it.
4. The panel reports what it found: "12 turns · 3,840 characters" and, when the
   cap bit, "older turns dropped to fit".
5. One line states what import is, at the moment it matters: "The council reads
   this as a document. It does not carry on the conversation." This is not
   optional copy — the harness has no assistant role, and a user who expects
   continuation will read the answers as wrong.
6. The user clicks "Use this". The seed lands **in the question box**, editable,
   and the panel closes. No clipboard, no manual paste.
7. The user adds their actual question above the quoted block and asks. From
   here it is flow 2.

### Flow 5 — approve a write

1. Mid-turn, one or more voices call `record_decision`. The harness emits
   `tool.approval_required` per thread and the turn ends.
2. The composer is replaced by the approval block. The top bar reads "waiting on
   you". The turn gets its wait-coloured border. The tab title changes.
3. The block lists each parked voice with what it proposes to write.
4. The user reads and clicks "Approve all 2", or writes a reason and clicks
   "Deny all 2".
5. The block is replaced by the composer in a disabled, working state. The
   status returns to "working". The activity line reads "Recording the
   decision".
6. A new harness turn resumes the same on-screen turn — `reduceTranscript`
   already handles this, folding the resume into the open exchange rather than
   opening an empty one.
7. On success, the turn shows "Recorded: <the decision text>" and the ledger
   count in the top bar increments. **This confirmation does not exist today**
   and it is the payoff of the entire interaction.
8. On denial, the turn records that too: "Declined" plus the reason, so the
   record of a refusal is as durable as the record of a write.

### Flow 6 — reopen a past session

1. The user clicks the session name in the top bar and picks from the list.
2. `GET /api/sessions?id=…` returns the projected transcript; the centre column
   fills with the whole conversation, scrolled to the bottom.
3. **The composer is disabled, with one line saying why:** "This conversation was
   started before the app restarted. You can read it, but not continue it."
   That is the real behaviour — `POST /api/council` 403s any session it did not
   hand out, and `useCouncilStream` suppresses pending approvals on a rehydrated
   session because every button press would fail. Today the composer stays
   enabled and looks ready. The user writes a follow-up, presses ask, and gets a
   fork with no explanation of what happened to the conversation they were
   looking at.
4. The disabled composer offers one action: "Ask this again in a new
   conversation", which copies the last question into a fresh session.
5. Sessions this process _did_ start stay continuable and their composer stays
   enabled. The list should mark the difference before the user clicks, not
   after.

---

## 7. What to cut for the demo

In order. Each cut names what it buys back.

**1. `/canvas`, `lib/canvas/`, and the tldraw dependency.**
Buys back: the single largest dependency, roughly 500 lines of unwired UI, the
concurrent-stream problem, and the ambiguity about which surface is the product.
It also removes the risk that a judge opens `/canvas` and finds a beautiful
surface that does nothing. Highest value, lowest regret, do it first.

**2. The jobs rail and its types.**
Buys back: the right-hand column, and the credibility cost of a component whose
only visible string describes a feature that cannot be started.

**3. The right-hand aside; sessions into a top-bar menu.**
Buys back: 288px of width for the transcript, and one fewer top-level region for
the eye to triage.

**4. The import panel as a page section; import into the composer.**
Buys back: a whole block off the main screen, and the copy-then-paste handoff.

**5. Persona authoring, "built" personas, and anything scraping-shaped.**
Buys back: nothing to build. `POST /api/personas` and the seeding logic already
work server-side and can be demonstrated by the two packs in `profiles/`
appearing as chips. Do not build a persona editor for this demo.

**6. Bright Data web search, as a concept, from the UI.**
It is already off in practice — its tools 407 on execution and the spec only
attaches it when the harness reports it — so the only work here is making sure
no copy anywhere promises the council can search the web. Check the empty state
and the scope copy.

**7. The two-pane compare.**
This is the one canvas idea worth keeping, and it is also the first thing to
drop if the clock runs out. Two fixed panes, the same question, two different
scopes, answering side by side, is the most persuasive thirty seconds this
product has. It is also a nice-to-have on top of a console that already works.
Build it only if the six cuts above have already landed and the approval moment
is finished.

### What is not cut, at any price

- The approval block, with the proposed write visible in it.
- The scope control in the composer, with its capability sentences and the
  correct repo name.
- The activity line, including `sandbox.created`.
- The ledger confirmation after an approved write.

Those four are the product. Everything else is furniture.

---

## 8. Where I am unsure

Stated plainly, because designing around a guess here would be worse than
saying so.

1. **Whether `tool.approval_required` carries the tool call's arguments.**
   Section 4 depends on it. `approvalsFrom` reads only `tool_calls[].id` and
   `function.name` today, which tells us nothing either way. If the arguments are
   not on the event, the approval block cannot show what it is approving, and the
   fallback — fetching them, or having the agent state the decision in its
   message before calling the tool — needs designing separately. Check a captured
   event before building the block.

2. **What happens when a human approves after the sandbox has stopped.** Five
   minutes is a short leash for a human decision. I do not know whether the
   resume errors, degrades, or succeeds. This shapes how patient the approval
   block is allowed to be.

3. **Whether reopened sessions should ever become continuable.** Today the
   ownership check in `/api/council` is a deliberate security boundary and I am
   not proposing to widen it. But it means the session list is a reading feature
   only, which is a smaller feature than it appears to be, and it may not deserve
   even the top-bar menu. Worth deciding on evidence about how often anyone
   reopens anything.

4. **Whether the ledger view can read the file in every deployment.** Reading
   `.outside/decisions.jsonl` from a route assumes the app process wrote it,
   which is true locally and may not be true if the app is ever deployed apart
   from the harness. Fine for the hackathon; note it before it becomes an
   assumption nobody remembers making.

5. **Stacked versus columned voices.** I have argued for stacking full-width
   because two long reviews in narrow columns read badly and four is unusable.
   With two short answers on a wide screen, columns may genuinely win. This is
   worth ten minutes with real output before it is settled, and it is the one
   recommendation here I would change most readily.
