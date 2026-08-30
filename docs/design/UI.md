# UI

The visual system for the Outside console. Live picture of it:
[`/design-preview`](../../app/design-preview/page.tsx) — static, hardcoded, no
harness calls.

This extends the palette already in `app/globals.css`. It does not replace it.
Five tokens are added and two are corrected for contrast; everything else stays
exactly as it is.

## 1. What this screen is

A control room. At any moment it has to answer three questions without being
asked:

1. What is the agent doing?
2. What is it waiting on?
3. What did it do?

The audience lives in a terminal and is mid-task. They did not come here to
browse. Every pixel that does not answer one of those three questions is in the
way.

### What was wrong

The current `/` puts persona chips, a scope toggle, a question box, streaming
columns, a session list, a jobs rail, an import panel and an approval strip on
one screen at roughly equal weight. Nothing is loudest, so nothing is first.
Three specific failures:

- **The gate is a strip.** A parked write is the one moment a human must act,
  and it renders as a bar of the same colour and weight as everything else.
- **Scope is a segmented pill.** It looks like a preference. It is a capability
  boundary — in plan-only the model is not offered file tools at all.
- **Everything is `text-xs` in a bordered box.** Answers are the product and
  they read at the same size as a timestamp.

### The fix, in one line

Rank the screen by who has to act. **Held beats working beats done**, and the
layout, colour and type all say so in the same direction.

## 2. Layout

Two columns and a dock. Not a card grid.

```
┌──────────────────────────────────────────────────────────────────────┐
│ status bar   Outside · council · working      1 build  ● sandbox on  │ 40px
├───────────┬──────────────────────────────────────────────────────────┤
│           │ ▌ question                                       working │
│  rail     │ ▌ ┌ voice ─┐ ┌ voice ─┐ ┌ voice ─┐                        │
│  240px    │ ▌ │        │ │      ▋ │ │      ▋ │        transcript      │
│           │ ▌ └────────┘ └────────┘ └────────┘        (scrolls)       │
│  scope    │ ▌                                                         │
│  council  ├──────────────────────────────────────────────────────────┤
│  sessions │  the dock — the ask box, OR the gate. Never both.         │
└───────────┴──────────────────────────────────────────────────────────┘
```

| Region     | Size         | Scrolls | Holds                            |
| ---------- | ------------ | ------- | -------------------------------- |
| Status bar | 40px, fixed  | no      | identity, live state, lamps      |
| Rail       | 240px, fixed | yes     | scope, council, sessions         |
| Transcript | fills        | yes     | exchanges, newest at the bottom  |
| Dock       | fits content | no      | ask box **or** the approval gate |

**The spine.** A 2px rule runs down the left edge of the transcript column, from
the first exchange to the bottom of the dock. It is one continuous line, and its
colour changes per exchange: grey for done, accent for working, `wait` for held.
It is a state timeline you read at a glance, and when a turn parks it runs
straight into the gate's own left edge. The gate is visibly wired to the
exchange that raised it.

This is why the transcript has no horizontal padding of its own — the padding
lives inside each exchange, after its border, so the rule sits at x=0 of the
column and the dock's rule lines up with it exactly.

### Widths

| Viewport  | Rail                          | Voice columns  |
| --------- | ----------------------------- | -------------- |
| ≥ 1280px  | 240px, fixed                  | up to 3 across |
| 1024–1279 | 240px, fixed                  | 2 across       |
| < 1024px  | sheet, opened from status bar | 1, stacked     |

Voice columns are `repeat(auto-fit, minmax(19rem, 1fr))`. They fit as many as
the width allows and wrap to a second row rather than shrinking below 19rem,
because a column narrower than that stops being readable prose and starts being
a phone number. The table above is what that resolves to at a 240px rail.

**The gate is never behind a disclosure at any width.** If the viewport is too
small for the rail, the rail collapses. The gate does not.

## 3. The three states

The whole product is legible or not depending on these. Each gets a different
kind of treatment, not just a different colour word.

| State       | Spine / panel edge  | Panel fill  | Marker                 | Loudness |
| ----------- | ------------------- | ----------- | ---------------------- | -------- |
| **held**    | `wait`, 2px         | `wait-wash` | filled `HELD` chip     | 1st      |
| **working** | `accent`, 2px       | `raised`    | word `working` + caret | 2nd      |
| **done**    | `line-control`, 2px | `raised`    | word `done`, grey      | 3rd      |

Three rules hold this together:

1. **Chroma is reserved for state that needs a human.** `done` is grey on
   purpose. A finished answer is reference material — it should recede so the
   live one and the parked one stand out.
2. **`wait` is the only status colour ever used as a fill.** Everything else
   uses it as a 2px edge or a word. That is what makes the gate unmistakable.
3. **`ok` (green) marks a completed write, not a completed turn.** A green tick
   should mean "this was recorded and cannot be undone", which is worth
   noticing. Spending it on "the turn ended" wastes it on the common case.

Error is a fourth state but it belongs to the turn, not to a voice: `stop`
border, one mono line in the dock, stated once. It does not take the ask box
away, because asking again is the recovery.

## 4. The approval gate

This is the product. A parked write is the only moment a human is required, and
it must be impossible to miss or to misread.

**The gate replaces the ask box. It does not sit next to it.** That is not a
stylistic choice — the harness rejects a turn that mixes a `user.message` with
approval items (see [ARCHITECTURE.md](../ARCHITECTURE.md#approvals-there-is-no-approval-endpoint)),
so while a call is parked there is genuinely nothing you can type. Removing the
place to type is the honest rendering of that constraint.

Anatomy, top to bottom:

- A 2px `wait` rule across the top and down the left, continuing the spine.
- The full panel filled with `wait-wash` — the only status-coloured fill in the
  product.
- A filled `HELD` chip, then a 22px headline naming **how many voices** want to
  write. 22px appears nowhere else.
- One line: _"Nothing has been written. The turn is parked until you answer."_
  The reassurance is the first thing after the headline because the reflex on
  seeing a warning colour is to assume something already happened.
- **One row per parked call**, each with its own `wait` bar: the voice's name,
  the tool name in mono, and the value it wants to record, quoted.
- The footer states the constraint plainly, then `Deny all` and `Approve all`.

### More than one voice

A council fans out and each subagent parks its own write on its own thread, so
several calls arrive at once and one voice can want two entries. The design
handles that by **listing every call individually rather than counting them**. A
badge reading `×2` tells you a number; two rows tell you which two decisions,
and which decision you are about to make is the entire basis for making it.

Four calls fit without scrolling. Past five the list scrolls inside the gate, so
the gate never grows tall enough to push the transcript off screen.

There is one button pair because there is one decision. The harness refuses a
resume that leaves any call unanswered — _"Send batch must resolve all pending
tool calls awaiting user input"_ — so per-voice buttons would offer a choice the
API cannot honour. The footer says so rather than letting someone discover it.

### Keyboard and screen reader

- `role="alertdialog"`, labelled _Write held for approval_.
- On park, focus moves to the gate's heading (`tabIndex={-1}`), **not to a
  button**. Landing focus on Approve means a reflex Enter records an
  irreversible write.
- `Deny all` comes first in DOM order for the same reason. Approve is visually
  primary; deny is physically first.
- The headline is the live region. It announces the count and the fact that
  nothing has been written yet.

## 5. Scope is a capability boundary

In plan-only the file tools are not offered to the model. It cannot quietly read
the codebase. The control has to feel like that, not like a checkbox.

Three moves, all in the rail:

1. **Two stacked rows, not a segmented pill.** The armed one carries a filled
   accent bar and a `raised` background. It reads as a breaker that is closed,
   not as a tab that is selected.
2. **A capability manifest underneath**, listing the actual tools. In repo
   scope: `clone + read files — on`, `run a script — on`,
   `write to ledger — gated`. In plan-only the first two are **struck through**
   and the third is replaced by `no sandbox is created`. Struck through, not
   dimmed: the tool is gone, not deselected.
3. **The spine becomes a wall.** In plan-only the transcript's left rule is
   replaced, in the same column of pixels, by a 10px hatched band. Same
   position, different substance. There is a boundary there now.

Two supporting readouts:

- The status bar carries a lamp: a filled `ok` dot for `sandbox on`, a hollow
  ring for `sandbox off`. It flips on the real `sandbox.created` event, so it is
  a readout of what happened, not a mirror of the switch.
- In plan-only, answers have **no citation footer at all**. In repo scope they
  cite the files they read. The absence is the proof.

## 6. Type

IBM Plex Sans and IBM Plex Mono, both already loaded.

| Size | Line height | Face | Used for                                  |
| ---- | ----------- | ---- | ----------------------------------------- |
| 22px | 28px        | sans | the gate headline. Nothing else.          |
| 18px | 28px        | sans | the question                              |
| 15px | 24px        | sans | **the answer body**, and the ask box      |
| 13px | 20px        | sans | labels, stances, secondary prose, buttons |
| 12px | 18px        | mono | file paths, tool arguments, data          |
| 11px | 16px        | mono | status words, region labels, chrome       |

Weights: 400 body, 500 medium for names and buttons, 600 for the wordmark. No
700 anywhere.

The answer body at 15px is the biggest change from the current console, where
everything sits at 12–13px. Answers are what the user came for and they should
read like prose, not like log output.

### Mono is for data, never for decoration

Allowed: status words, tool names, thread and session ids, file paths, counts,
timestamps, and region labels. Region labels (`SCOPE`, `COUNCIL`, `SESSIONS`)
are 11px mono uppercase with `0.14em` tracking — that is the one non-data use,
and it earns its place by marking a line as chrome so the eye skips it.

Banned in mono: the question, answer bodies, headlines, button labels, any
sentence a person wrote for another person to read.

## 7. Spacing

4px base unit. Everything vertical lands on it.

| Step | Used for                                            |
| ---- | --------------------------------------------------- |
| 4px  | chip padding, gap between a name and its tag        |
| 8px  | gap between rows in a list                          |
| 12px | panel padding, gap between a gutter and its content |
| 16px | gap between voice columns                           |
| 24px | exchange padding, dock padding                      |
| 48px | between exchanges (24px of padding on either side)  |

Fixed, not fluid: rail 240px, status bar 40px, spine 2px, hatch band 10px. A
control room has a fixed panel layout. Nothing here is draggable or resizable,
because a layout the user can break is a layout they have to maintain.

## 8. The empty state

First run has no sessions, no transcript, and nothing to show. It does not get a
hero or an illustration. It gets **the legend**.

- A heading: _Nothing asked yet._
- Two sentences saying how many voices are loaded, what scope is armed, and that
  each voice answers in its own column.
- Then **Reading the column edges**: the three states, each rendered with its
  real 2px gutter and its real status marker, next to one line of plain English.

Control rooms have a key on the wall. Teaching the vocabulary before it matters
is cheaper than teaching it during the one moment the user has to make an
irreversible call.

## 9. Streaming

Text arrives token by token across several columns at once. Design for text that
grows, not text that has already arrived.

- **The grid is fixed before the text lands.** Columns are set by the voice
  count, and each panel has a 10rem minimum. Growing text extends a panel
  downward; it never reflows the columns or moves a neighbour sideways.
- **Panels in one exchange share a row height.** Grid stretch does this for
  free, and it stops a two-line answer sitting next to a forty-line one in a
  ragged staircase.
- **The caret is the only per-token motion.** A 0.5ch accent block after the
  last character, blinking on a 1.1s hard step. It exists to prove a slow stream
  is still a stream. There is no fade-in per token: at hundreds of deltas a
  second that is expensive and it looks like a toy.
- **A thread with no text yet shows its status word and nothing else.** No
  skeleton, no shimmer. A shimmer implies a known shape arriving; a subagent
  that has not spoken has no known shape.
- **Auto-scroll pins to the bottom while streaming and releases the moment the
  user scrolls up.** It does not re-pin on its own. Yanking someone back to the
  bottom while they are reading is worse than a stale viewport.
- The root thread's delegation narration is a closed `<details>` on a hairline
  rule. It is available and it does not compete.

## 10. Focus

One ring, everywhere:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 2px;
}
```

`accent` measures 12.9:1 on `base`, 12.2:1 on `raised` and 11.9:1 on
`wait-wash`, so the same ring survives every surface including inside the gate.
`:focus-visible` rather than `:focus`: a mouse user who just clicked does not
need a box drawn around it.

Never remove an outline without replacing it. Every interactive element is a
real `<button>` — no `div role="button"`, no `tabIndex` on a `span`.

One fix carried over from the current console: a persona's stance lives in a
`title` attribute, which is invisible to keyboard and touch. Here it is a
visible second line on the row.

## 11. Motion

Motion is expensive attention. Four uses earn it; everything else is banned.

| Motion               | Duration       | Why it earns it                            |
| -------------------- | -------------- | ------------------------------------------ |
| Gate entrance        | 160ms ease-out | A state change you must not miss.          |
| Spine colour change  | 160ms          | Ties the gate to the exchange that parked. |
| Caret blink          | 1.1s step      | Liveness on a slow stream.                 |
| Hover on interactive | 100ms, colour  | Feedback. Colour only, no transform.       |

Banned: entrance animations on transcript content (arriving text is already
motion), per-token fades, skeleton shimmer, card lift or translate on hover,
spinners. A spinner adds nothing over the word `working` next to a caret.

`prefers-reduced-motion: reduce` stops the caret blinking (it stays solid,
because it still carries meaning) and makes the gate appear instantly. The gate
never depends on motion to be noticed — the fill, the chip and the 22px headline
do that work on their own.

## 12. Colour

### Added

Paste into the `@theme` block in `app/globals.css`:

```css
--color-sunken: #08090a;
--color-line-hair: #191b1f;
--color-line-control: #5e636c;
--color-wait-wash: #1a1810;
--color-on-accent: #0b0c0e;
```

| Token                  | Why it exists                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-sunken`       | Depth needs two directions. Everything currently nests at `raised`, so a panel inside a panel reads flat. `sunken` is _below_ base and holds the transcript bed and the ask box, so wells recess and panels rise. |
| `--color-line-hair`    | One line colour cannot both edge a panel and divide its insides. Internal rules at `line` compete with the panel's own border.                                                                                    |
| `--color-line-control` | The border of anything focusable. Measures **3.19:1** on base, meeting WCAG 1.4.11. `line` (1.27:1) and `line-strong` (1.61:1) do not, and stay decorative.                                                       |
| `--color-wait-wash`    | `wait` at 8% over base. The held flood, used by the gate and by a held voice panel. A token rather than an inline `color-mix` so the two always agree.                                                            |
| `--color-on-accent`    | Text on the accent fill. The buttons currently use literal `text-black`, which is harsher than the palette's own near-black. 12.9:1.                                                                              |

### Corrected

Two existing tokens fail WCAG AA where the codebase already uses them for real
sentences. Same hue, same role, minimum shift to clear 4.5:1.

| Token               | From      | To        | Was                        | Now                        |
| ------------------- | --------- | --------- | -------------------------- | -------------------------- |
| `--color-ink-faint` | `#6b7280` | `#7a8290` | 3.98:1 base, 3.75:1 raised | 4.98:1 base, 4.68:1 raised |
| `--color-stop`      | `#c05f4f` | `#c8695a` | 4.58:1 base, 4.31:1 raised | 5.16:1 base, 4.86:1 raised |

`ink-faint` carries whole sentences today (session empty states, the jobs
message, timestamps) and `stop` renders error text on `raised` in the approval
strip. Both are below AA at those sizes.

### Measured

Every pair the design actually uses, against `#0b0c0e`:

| Colour                  | On base | On raised | On wait-wash |
| ----------------------- | ------- | --------- | ------------ |
| `ink` `#e8eaed`         | 16.0:1  | 15.0:1    | 14.7:1       |
| `ink-muted` `#9aa0a8`   | 7.3:1   | 6.9:1     | 6.7:1        |
| `ink-faint` `#7a8290`   | 4.98:1  | 4.68:1    | —            |
| `accent` `#d7d3c8`      | 12.9:1  | 12.2:1    | 11.9:1       |
| `wait` `#c9a227`        | 7.96:1  | 7.5:1     | 7.3:1        |
| `ok` `#6ea87a`          | 6.93:1  | 6.5:1     | —            |
| `stop` `#c8695a`        | 5.16:1  | 4.86:1    | —            |
| `on-accent` on `accent` | 12.9:1  | —         | —            |

Non-text boundaries, against the 3:1 bar in WCAG 1.4.11:

| Colour                   | On base | Verdict                                    |
| ------------------------ | ------- | ------------------------------------------ |
| `line-control` `#5e636c` | 3.19:1  | passes — required for every control border |
| `line-strong` `#33373e`  | 1.61:1  | decorative only                            |
| `line` `#23262b`         | 1.27:1  | decorative only                            |

The rule: **if you can type in it or click it, its border is `line-control`.**
`line` and `line-strong` may only be used where the component is identifiable
without the border — panel edges, list separators, section rules.

### Not in this palette

No purple-to-blue gradient. No neon. No glassmorphism or backdrop blur. No
generic drop shadows — depth comes from `sunken`/`base`/`raised`, which is three
steps and enough. The accent stays a warm bone, deliberately not a signal
colour, so that `wait` has nothing to compete with when it matters.

## 13. Things I moved, and why

**Jobs left the rail for the status bar.** A persona build never blocks the
council, and a failed one degrades to the fixture personas. It has no business
holding a permanent panel next to the controls that matter. It is now a count in
the status bar, and it shows nothing at all when there are no builds. This is
the "fake jobs rail" complaint, answered by deletion.

**Persona chips became rail rows.** Chips had no room for the stance, so it hid
in a `title` tooltip. As rows the stance is visible, which is the thing that
tells you whether to include that voice.

**Scope left the header for the rail.** The header shows the _consequence_
(`sandbox on/off`); the rail holds the _control_. Switch on the panel, lamp on
the board.

**Import is not on this screen.** It is a paste box producing a string you paste
into another box on the same page. Either it becomes a real seed action inside
the ask box, or it moves to its own route. Sitting under the console competing
with the gate is the one option that should not survive.

## 14. Where I disagreed with what is there now

- **Green for `done` is a waste of the only green in the palette.** The current
  console marks a finished turn with `ok`. Finishing is the common case and it
  needs nothing from the reader. `ok` should mark a write that was recorded —
  the irreversible thing — and `done` should be grey.
- **The approval strip's `×2` badge should be two rows.** A count tells you how
  many decisions you are about to make; it does not tell you what they are, and
  what they are is the whole basis for the answer.
- **`text-xs` everywhere is not density, it is flatness.** Density comes from
  tight spacing and a fixed grid. Shrinking the type only makes the answers
  harder to read while leaving the hierarchy exactly as flat as it was.

## 15. Not specified here

Left open on purpose, because they need evidence rather than a preference:

- Whether reopening a past session should visually mark itself read-only. The
  hook already refuses approvals on a rehydrated session; the UI does not say so
  yet.
- Whether an exchange should be collapsible once done. Worth it only if real
  transcripts get long enough to be annoying — measure first.
- The canvas route. It shares these tokens and the three states, but its layout
  is its own problem and `/canvas` is not wired up yet.
