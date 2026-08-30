import type { ReactNode } from 'react';

/**
 * A picture of the proposed console, not a feature.
 *
 * Everything here is hardcoded. No harness calls, no fetching, no state. It
 * exists so the layout can be argued about at real size before any of it is
 * wired up. The spec it illustrates is docs/design/UI.md.
 *
 * The tokens this design adds are declared on `.dp` rather than in
 * `app/globals.css`, because five feature branches are in flight against that
 * file right now. UI.md lists the block to paste into `@theme` when the design
 * lands; until then the preview is the only place they exist.
 */

const CSS = `
.dp {
  /* Added. Rationale for each is in docs/design/UI.md. */
  --color-sunken: #08090a;
  --color-line-hair: #191b1f;
  --color-line-control: #5e636c;
  --color-wait-wash: #1a1810;
  --color-on-accent: #0b0c0e;

  /* Corrected for contrast. Same hue, same role, measured in UI.md. */
  --color-ink-faint: #7a8290;
  --color-stop: #c8695a;
}

/* One ring for everything focusable. Accent reads at 12.9:1 on base and 11:1 on
   the held wash, so it survives every surface in the product. Keyboard only —
   a mouse user who just clicked does not need a box drawn round it. Tab through
   this page to see it. */
.dp :focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Liveness, not decoration: proof that a slow stream is still a stream. */
.dp-caret {
  display: inline-block;
  width: 0.5ch;
  height: 0.95em;
  margin-left: 0.15ch;
  vertical-align: -0.1em;
  background: var(--color-accent);
  animation: dp-blink 1.1s steps(1, end) infinite;
}
@keyframes dp-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

/* Plan-only replaces the spine with a wall, in the same column of pixels. The
   agent has no file tools in this scope, and the boundary is a thing you can
   see rather than a sentence you have to find. A 10px band, not a fill. */
.dp-wall {
  background-image: repeating-linear-gradient(
    -45deg,
    var(--color-line-control) 0 1px,
    transparent 1px 7px
  );
  background-size: 10px 100%;
  background-repeat: no-repeat;
}

/* The one attention move in the product. A parked write must not slip past. */
.dp-gate { animation: dp-raise 160ms ease-out both; }
@keyframes dp-raise {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .dp-caret { animation: none; opacity: 1; }
  .dp-gate { animation: none; }
}
`;

/* ---------------------------------------------------------------- state ---- */

type VoiceState = 'working' | 'held' | 'done';

/**
 * Chroma is reserved for state that needs a human, so `done` is deliberately
 * grey. Left-edge only: these sit on elements that also carry hairline borders
 * on other sides, and a bare `border-wait` would paint all four.
 */
const GUTTER: Record<VoiceState, string> = {
  working: 'border-l-accent',
  held: 'border-l-wait',
  done: 'border-l-[var(--color-line-control)]',
};

function StateWord({ state }: { state: VoiceState }) {
  if (state === 'held') {
    return (
      <span className="bg-wait rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-[var(--color-on-accent)]">
        HELD
      </span>
    );
  }
  return (
    <span
      className={`font-mono text-[11px] ${state === 'working' ? 'text-accent' : 'text-ink-faint'}`}
    >
      {state}
    </span>
  );
}

/* ------------------------------------------------------------- the rail ---- */

const COUNCIL = [
  {
    name: 'Hostile Reviewer',
    stance: 'Assumes the change is wrong until the diff proves otherwise.',
    origin: 'fixture',
  },
  { name: 'Shipper', stance: 'Asks what can be cut to land this today.', origin: 'fixture' },
  {
    name: 'Test-First',
    stance: 'Grown from a public engineering blog. Asks what the test would be.',
    origin: 'built',
  },
];

/**
 * Scope is not a preference. It is the tool list, and the tool list is what
 * changes, so the control shows the tool list changing.
 */
function ScopeBlock({ scope }: { scope: 'repo' | 'plan' }) {
  const repo = scope === 'repo';

  return (
    <section>
      <RailLabel>Scope</RailLabel>
      <div className="border-line divide-y divide-[var(--color-line-hair)] rounded border">
        <ScopeRow armed={repo} title="This repo" note="clones and reads the working tree" />
        <ScopeRow armed={!repo} title="Plan only" note="no sandbox, nothing to read" />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 pl-0.5">
        <Capability label="clone + read files" on={repo} />
        <Capability label="run a script" on={repo} />
        {repo ? (
          <li className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
            <span className="text-ink-muted">write to ledger</span>
            <span className="text-wait">gated</span>
          </li>
        ) : (
          <li className="text-ink-faint font-mono text-[11px]">no sandbox is created</li>
        )}
      </ul>
    </section>
  );
}

function ScopeRow({ armed, title, note }: { armed: boolean; title: string; note: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={armed}
      tabIndex={armed ? 0 : -1}
      className={`flex w-full gap-2.5 px-2.5 py-2 text-left ${armed ? 'bg-raised' : ''}`}
    >
      <span
        aria-hidden
        className={`mt-0.5 w-0.5 shrink-0 self-stretch ${armed ? 'bg-accent' : 'bg-line'}`}
      />
      <span className="min-w-0">
        <span className={`block text-[13px] ${armed ? 'text-ink font-medium' : 'text-ink-muted'}`}>
          {title}
        </span>
        <span
          className={`mt-0.5 block text-[12px] leading-4 ${armed ? 'text-ink-muted' : 'text-ink-faint'}`}
        >
          {note}
        </span>
      </span>
    </button>
  );
}

/** Off is struck through, not dimmed. The tool is gone, not deselected. */
function Capability({ label, on }: { label: string; on: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
      <span className={on ? 'text-ink-muted' : 'text-ink-faint line-through decoration-1'}>
        {label}
      </span>
      <span className={on ? 'text-ok' : 'text-ink-faint'}>{on ? 'on' : 'off'}</span>
    </li>
  );
}

function RailLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-ink-faint mb-2 font-mono text-[11px] tracking-[0.14em] uppercase">
      {children}
    </h2>
  );
}

function Rail({
  scope,
  sessions,
  selected,
}: {
  scope: 'repo' | 'plan';
  sessions: string[];
  selected: number;
}) {
  return (
    <aside className="border-line bg-base flex w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r px-4 py-5">
      <ScopeBlock scope={scope} />

      <section>
        <RailLabel>Council</RailLabel>
        <ul className="flex flex-col">
          {COUNCIL.map((p, i) => {
            const on = i < selected;
            return (
              <li key={p.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  className="flex w-full gap-2.5 border-b border-[var(--color-line-hair)] py-2 text-left last:border-0"
                >
                  <span
                    aria-hidden
                    className={`mt-1 w-0.5 shrink-0 self-stretch ${on ? 'bg-accent' : 'bg-line'}`}
                  />
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`text-[13px] ${on ? 'text-ink font-medium' : 'text-ink-muted'}`}
                      >
                        {p.name}
                      </span>
                      {p.origin === 'built' ? (
                        <span className="text-ink-faint font-mono text-[10px]">built</span>
                      ) : null}
                    </span>
                    <span
                      className={`mt-0.5 block text-[12px] leading-4 ${on ? 'text-ink-muted' : 'text-ink-faint'}`}
                    >
                      {p.stance}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <RailLabel>Sessions</RailLabel>
        {sessions.length === 0 ? (
          <p className="text-ink-faint text-[12px] leading-5">No past sessions on this harness.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  aria-current={i === 0 ? 'true' : undefined}
                  className={`flex w-full gap-2.5 rounded-sm py-1.5 pr-1 text-left ${i === 0 ? 'bg-raised' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`w-0.5 shrink-0 self-stretch ${i === 0 ? 'bg-accent' : 'bg-transparent'}`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-[12px] ${i === 0 ? 'text-ink' : 'text-ink-muted'}`}
                    >
                      {s}
                    </span>
                    <span className="text-ink-faint block font-mono text-[10px]">
                      {i === 0 ? 'now' : `${i * 17}m ago`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

/* -------------------------------------------------------- the status bar ---- */

/**
 * The board. Identity, the one live state word, the capability lamp, and the
 * session id — nothing else competes for this row.
 *
 * Persona builds live here as a count rather than in the rail. A build never
 * blocks the council and a failed one degrades to the fixture personas, so it
 * has no business holding a permanent panel next to the controls that matter.
 */
function StatusBar({
  status,
  sandbox,
  session,
  builds,
}: {
  status: { word: string; tone: string };
  sandbox: boolean;
  session: string;
  builds?: number;
}) {
  return (
    <header className="border-line flex h-10 shrink-0 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-semibold tracking-tight">Outside</span>
        <span className="text-ink-faint font-mono text-[11px]">council</span>
        <span className={`font-mono text-[11px] ${status.tone}`}>{status.word}</span>
      </div>
      <div className="flex items-center gap-4">
        {builds ? (
          <button
            type="button"
            className="text-ink-muted border-line rounded border px-1.5 py-0.5 font-mono text-[11px]"
          >
            {builds} persona {builds === 1 ? 'build' : 'builds'}
          </button>
        ) : null}
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${sandbox ? 'bg-ok' : 'border-ink-faint border'}`}
          />
          <span className={sandbox ? 'text-ink-muted' : 'text-ink-faint'}>
            sandbox {sandbox ? 'on' : 'off'}
          </span>
        </span>
        <span className="text-ink-faint font-mono text-[11px]">{session}</span>
      </div>
    </header>
  );
}

/* --------------------------------------------------------- the transcript ---- */

interface Voice {
  name: string;
  state: VoiceState;
  text: string;
  cites?: string[];
}

function VoicePanel({ voice }: { voice: Voice }) {
  const held = voice.state === 'held';

  return (
    <section
      className={`flex min-h-40 flex-col border-l-2 ${GUTTER[voice.state]} ${
        held ? 'bg-[var(--color-wait-wash)]' : 'bg-raised'
      }`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-line-hair)] px-3 py-2">
        <span className="text-ink truncate text-[13px] font-medium">{voice.name}</span>
        <StateWord state={voice.state} />
      </header>

      <p className="text-ink flex-1 px-3 py-2.5 text-[15px] leading-6">
        {voice.text}
        {voice.state === 'working' ? <span aria-hidden className="dp-caret" /> : null}
      </p>

      {voice.cites ? (
        <ul className="flex flex-col gap-0.5 border-t border-[var(--color-line-hair)] px-3 py-2">
          {voice.cites.map((c) => (
            <li key={c} className="text-ink-muted font-mono text-[12px]">
              {c}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Exchange({
  question,
  state,
  voices,
  delegation,
  wall,
}: {
  question: string;
  state: VoiceState;
  voices: Voice[];
  delegation?: string;
  wall?: boolean;
}) {
  return (
    <article className={`border-l-2 p-6 ${wall ? 'dp-wall' : GUTTER[state]}`}>
      <header className="mb-3 flex items-baseline justify-between gap-6">
        <h3 className="text-ink max-w-[68ch] text-[18px] leading-7">{question}</h3>
        <StateWord state={state} />
      </header>

      {delegation ? (
        <details className="mb-3 border-y border-[var(--color-line-hair)] py-1.5">
          <summary className="text-ink-faint cursor-pointer font-mono text-[11px]">
            root thread — delegation
          </summary>
          <p className="text-ink-muted mt-2 text-[13px] leading-5">{delegation}</p>
        </details>
      ) : null}

      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))] gap-4">
        {voices.map((v) => (
          <VoicePanel key={v.name} voice={v} />
        ))}
      </div>
    </article>
  );
}

/* --------------------------------------------------------------- the dock ---- */

function AskBox({ scope, voices }: { scope: 'repo' | 'plan'; voices: number }) {
  const repo = scope === 'repo';

  return (
    <div className="border-line bg-base shrink-0 border-t px-6 py-4">
      <div className="rounded border border-[var(--color-line-control)] bg-[var(--color-sunken)] px-3 py-2.5">
        <p className="text-ink-faint text-[15px] leading-6">
          {repo
            ? 'Ask about the work in progress. Answers cite the files they read.'
            : 'Ask about the plan. The council cannot open the repo in this scope.'}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-ink-faint font-mono text-[11px]">
          {repo ? 'clone + read on · ledger write gated' : 'no sandbox · no file tools'}
        </span>
        <button
          type="button"
          className="bg-accent rounded px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-on-accent)]"
        >
          Ask {voices} voices
        </button>
      </div>
    </div>
  );
}

interface ParkedCall {
  voice: string;
  tool: string;
  value: string;
}

/**
 * The gate takes the ask box's place rather than sitting beside it, because
 * that is what the harness does: a turn with a parked call rejects a
 * `user.message` in the same request. There is nothing to type until this is
 * answered, and the UI says so by removing the place to type.
 */
function Gate({ calls }: { calls: ParkedCall[] }) {
  const voices = new Set(calls.map((c) => c.voice)).size;

  return (
    <div
      role="alertdialog"
      aria-label="Write held for approval"
      className="dp-gate border-wait shrink-0 border-t-2 border-l-2 bg-[var(--color-wait-wash)] px-6 py-4"
    >
      <div className="flex items-start gap-3">
        <span className="bg-wait mt-1 shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-[var(--color-on-accent)]">
          HELD
        </span>
        <div className="min-w-0">
          <h2 className="text-ink text-[22px] leading-7 font-medium">
            {voices === 1 ? 'One voice wants' : `${voices} voices want`} to write to the decision
            ledger.
          </h2>
          <p className="text-ink-muted mt-1 text-[13px] leading-5">
            Nothing has been written. The turn is parked until you answer.
          </p>
        </div>
      </div>

      <ul className="mt-4 flex max-h-60 flex-col gap-2 overflow-y-auto">
        {calls.map((c) => (
          <li key={c.voice + c.value} className="border-wait flex gap-2.5 border-l-2 pl-2.5">
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-ink text-[13px] font-medium">{c.voice}</span>
                <span className="text-ink-faint font-mono text-[11px]">{c.tool}</span>
              </span>
              <span className="text-ink-muted mt-0.5 block text-[13px] leading-5">“{c.value}”</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-ink-muted max-w-[56ch] text-[12px] leading-5">
          {calls.length > 1
            ? `One decision answers all ${calls.length} calls. The harness will not resume a turn with any call left unanswered.`
            : 'Approving records the entry. It cannot be undone.'}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="text-ink rounded border border-[var(--color-line-control)] px-3.5 py-1.5 text-[13px]"
          >
            Deny{calls.length > 1 ? ' all' : ''}
          </button>
          <button
            type="button"
            className="bg-accent rounded px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-on-accent)]"
          >
            Approve{calls.length > 1 ? ' all' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ empty state ---- */

const LEGEND: { state: VoiceState; text: string }[] = [
  { state: 'working', text: 'the voice is still writing. Text arrives token by token.' },
  { state: 'held', text: 'it wants to write to the ledger and is waiting on you.' },
  { state: 'done', text: 'finished. Nothing is pending and nothing was written.' },
];

function EmptyState() {
  return (
    <div className="max-w-[62ch] px-1 pt-8">
      <h3 className="text-ink text-[18px] leading-7">Nothing asked yet.</h3>
      <p className="text-ink-muted mt-2 text-[15px] leading-6">
        Three voices are loaded and the scope is set to plan only, so the council answers from
        reasoning alone — it has no way to open the repo. Ask a question and each voice replies in
        its own column.
      </p>

      <h4 className="text-ink-faint mt-7 mb-2 font-mono text-[11px] tracking-[0.14em] uppercase">
        Reading the column edges
      </h4>
      <ul className="flex flex-col">
        {LEGEND.map((l) => (
          <li
            key={l.state}
            className={`flex items-baseline gap-3 border-b border-l-2 border-[var(--color-line-hair)] py-2.5 pl-3 last:border-b-0 ${GUTTER[l.state]}`}
          >
            <span className="w-16 shrink-0">
              <StateWord state={l.state} />
            </span>
            <span className="text-ink-muted text-[13px] leading-5">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- content ---- */

const SESSIONS = [
  'Ship the canvas read-only, or cut it from the demo?',
  'Is the import panel worth the surface area it costs?',
  'Where should the approval gate live in the layout?',
];

const PRIOR_QUESTION = 'Is the import panel worth the surface area it costs?';

const PRIOR_VOICES: Voice[] = [
  {
    name: 'Shipper',
    state: 'done',
    text: 'No. It is a paste box that produces a string you then paste somewhere else. Two steps to save zero.',
  },
  {
    name: 'Hostile Reviewer',
    state: 'done',
    text: 'It earns its place only if a judge arrives with an existing transcript. Nobody does.',
    cites: ['lib/import/seedMessage.ts'],
  },
];

const WORKING_VOICES: Voice[] = [
  {
    name: 'Hostile Reviewer',
    state: 'done',
    text: 'Read-only is not a smaller version of the canvas — it is a different product. CanvasBoard already mounts tldraw with hideUi and a custom shape util, so the cost is not the render, it is that the shape carries session state nothing writes to yet. Cut it or wire it. There is no cheap middle.',
    cites: ['app/canvas/_components/CanvasBoard.tsx', 'lib/canvas/focus.ts:31'],
  },
  {
    name: 'Shipper',
    state: 'working',
    text: 'Cut it. The demo is the approval gate and the gate lives on the console route. Every minute spent on a second surface is a minute the one that matters is not',
  },
  {
    name: 'Test-First',
    state: 'working',
    text: 'What is the test you would write for “read-only”? If you cannot name it in one sentence,',
  },
];

const HELD_VOICES: Voice[] = [
  {
    name: 'Hostile Reviewer',
    state: 'held',
    text: 'Agreed on read-only, and I want that on the record before anyone reopens it in two days. The failure mode here is not the decision, it is relitigating the decision.',
    cites: ['docs/CANVAS-PLAN.md'],
  },
  {
    name: 'Shipper',
    state: 'held',
    text: 'Same. Recording it is the only reason this conversation was worth having.',
  },
  {
    name: 'Test-First',
    state: 'done',
    text: 'No entry from me. I asked a question, I did not reach a decision, and the ledger is for decisions.',
  },
];

const HELD_CALLS: ParkedCall[] = [
  {
    voice: 'Hostile Reviewer',
    tool: 'record_decision',
    value: 'Canvas ships read-only in v1. Session windows are display, not input.',
  },
  {
    voice: 'Hostile Reviewer',
    tool: 'record_decision',
    value: 'Revisit only if the console route lands before Friday.',
  },
  {
    voice: 'Shipper',
    tool: 'record_decision',
    value: 'Import panel is cut from the demo path.',
  },
];

const FOUR_CALLS: ParkedCall[] = [
  ...HELD_CALLS,
  {
    voice: 'Test-First',
    tool: 'record_decision',
    value: 'A read-only canvas needs one characterization test before it ships.',
  },
];

/* ----------------------------------------------------------------- plates ---- */

function Plate({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="text-ink-faint font-mono text-[11px]">{n}</span>
        <h2 className="text-ink text-[18px] font-medium">{title}</h2>
        <p className="text-ink-muted max-w-[70ch] text-[13px] leading-5">{note}</p>
      </div>
      <div className="border-line overflow-hidden rounded border">{children}</div>
    </section>
  );
}

function Specimen() {
  const added = [
    ['--color-sunken', '#08090a', 'Recessed wells: the transcript bed and the ask box.'],
    ['--color-line-hair', '#191b1f', 'Dividers inside a panel, quieter than the panel edge.'],
    ['--color-line-control', '#5e636c', 'Border of anything focusable. 3.19:1 on base.'],
    ['--color-wait-wash', '#1a1810', 'The held flood. The only status colour used as a fill.'],
    ['--color-on-accent', '#0b0c0e', 'Text on the accent fill. 12.9:1.'],
  ];
  const fixed = [
    ['--color-ink-faint', '#6b7280', '#7a8290', '3.98:1 → 4.98:1 on base'],
    ['--color-stop', '#c05f4f', '#c8695a', '4.31:1 → 4.86:1 on raised'],
  ];

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="text-ink-faint font-mono text-[11px]">05</span>
        <h2 className="text-ink text-[18px] font-medium">Tokens</h2>
        <p className="text-ink-muted text-[13px]">
          Five added, two corrected. Nothing else in the palette moves.
        </p>
      </div>

      <div className="border-line grid divide-y divide-[var(--color-line-hair)] rounded border md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4">
          <RailLabel>Added</RailLabel>
          <ul className="flex flex-col gap-2.5">
            {added.map(([name, hex, why]) => (
              <li key={name} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-sm border border-[var(--color-line-hair)]"
                  style={{ background: hex }}
                />
                <span className="min-w-0">
                  <span className="text-ink block font-mono text-[12px]">
                    {name} <span className="text-ink-faint">{hex}</span>
                  </span>
                  <span className="text-ink-muted mt-0.5 block text-[13px] leading-5">{why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4">
          <RailLabel>Corrected for contrast</RailLabel>
          <ul className="flex flex-col gap-2.5">
            {fixed.map(([name, from, to, ratio]) => (
              <li key={name} className="flex gap-3">
                <span aria-hidden className="mt-0.5 flex shrink-0">
                  <span
                    className="h-8 w-4 rounded-l-sm border border-[var(--color-line-hair)]"
                    style={{ background: from }}
                  />
                  <span
                    className="h-8 w-4 rounded-r-sm border border-l-0 border-[var(--color-line-hair)]"
                    style={{ background: to }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="text-ink block font-mono text-[12px]">
                    {name}{' '}
                    <span className="text-ink-faint">
                      {from} → {to}
                    </span>
                  </span>
                  <span className="text-ink-muted mt-0.5 block text-[13px] leading-5">{ratio}</span>
                </span>
              </li>
            ))}
          </ul>

          <RailLabel>
            <span className="mt-6 block">Type scale</span>
          </RailLabel>
          <ul className="flex flex-col gap-1.5">
            <li className="text-ink text-[22px] leading-7 font-medium">22 — the gate headline</li>
            <li className="text-ink text-[18px] leading-7">18 — the question</li>
            <li className="text-ink text-[15px] leading-6">15 — the answer body</li>
            <li className="text-ink-muted text-[13px] leading-5">
              13 — labels and secondary prose
            </li>
            <li className="text-ink-muted font-mono text-[12px]">12 mono — file paths, data</li>
            <li className="text-ink-faint font-mono text-[11px]">11 mono — status words, chrome</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function DesignPreview() {
  return (
    <div className="dp bg-base text-ink min-h-screen">
      <style>{CSS}</style>

      <header className="border-line mx-auto max-w-[92rem] border-b px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-tight">Outside — console layout</h1>
        <p className="text-ink-muted mt-2 max-w-[72ch] text-[15px] leading-6">
          A static picture of the proposed console. Nothing here fetches, streams, or calls the
          harness. Four plates and a token sheet, at real size, so the layout can be argued about
          before it is built. The spec is{' '}
          <span className="font-mono text-[13px]">docs/design/UI.md</span>.
        </p>
      </header>

      <main className="mx-auto flex max-w-[92rem] flex-col gap-14 px-6 pt-10 pb-24">
        <Plate
          n="01"
          title="Working"
          note="Repo scope. One exchange finished, one live. The spine down the left is a state timeline: grey behind, bright where the stream is."
        >
          <div className="flex h-[46rem]">
            <Rail scope="repo" sessions={SESSIONS} selected={3} />
            <div className="flex min-w-0 flex-1 flex-col">
              <StatusBar
                status={{ word: 'working', tone: 'text-accent' }}
                sandbox
                session="ses_6fe7c4"
                builds={1}
              />
              <div className="flex flex-1 flex-col justify-end overflow-hidden bg-[var(--color-sunken)]">
                <Exchange question={PRIOR_QUESTION} state="done" voices={PRIOR_VOICES} />
                <Exchange
                  question="The canvas renders but does nothing. Ship it read-only in v1, or cut it?"
                  state="working"
                  delegation="Fanning out to three voices. Sandbox is up; each subagent has the working tree and may cite files it read."
                  voices={WORKING_VOICES}
                />
              </div>
              <AskBox scope="repo" voices={3} />
            </div>
          </div>
        </Plate>

        <Plate
          n="02"
          title="Held"
          note="Two voices parked a write between them, three calls in total. The gate replaces the ask box because the harness rejects a message and an approval in the same turn — there is genuinely nothing to type."
        >
          <div className="flex h-[46rem]">
            <Rail scope="repo" sessions={SESSIONS} selected={3} />
            <div className="flex min-w-0 flex-1 flex-col">
              <StatusBar
                status={{ word: 'waiting on you', tone: 'text-wait' }}
                sandbox
                session="ses_6fe7c4"
              />
              <div className="flex flex-1 flex-col justify-end overflow-hidden bg-[var(--color-sunken)]">
                <Exchange question={PRIOR_QUESTION} state="done" voices={PRIOR_VOICES} />
                <Exchange
                  question="The canvas renders but does nothing. Ship it read-only in v1, or cut it?"
                  state="held"
                  voices={HELD_VOICES}
                />
              </div>
              <Gate calls={HELD_CALLS} />
            </div>
          </div>
        </Plate>

        <Plate
          n="03"
          title="First run, plan only"
          note="Nothing exists yet, so the console teaches its own vocabulary instead of showing an empty box. Plan-only strikes the file tools out of the manifest and hatches the edge the answers would have come from."
        >
          <div className="flex h-[42rem]">
            <Rail scope="plan" sessions={[]} selected={2} />
            <div className="flex min-w-0 flex-1 flex-col">
              <StatusBar
                status={{ word: 'idle', tone: 'text-ink-faint' }}
                sandbox={false}
                session="no session"
              />
              <div className="flex-1 overflow-hidden bg-[var(--color-sunken)]">
                <div className="dp-wall h-full border-l-2 border-transparent px-6">
                  <EmptyState />
                </div>
              </div>
              <AskBox scope="plan" voices={2} />
            </div>
          </div>
        </Plate>

        <Plate
          n="04"
          title="The dock, at both edges"
          note="Two more docks at real width. Four calls fit without scrolling; past five the list scrolls inside the gate rather than pushing the transcript off screen. An error is stated once and does not take the ask box away."
        >
          <div className="flex flex-col divide-y divide-[var(--color-line-hair)]">
            <div>
              <p className="text-ink-faint bg-base px-6 pt-3 font-mono text-[11px]">
                four calls, three voices — one of them wants two entries
              </p>
              <Gate calls={FOUR_CALLS} />
            </div>
            <div>
              <p className="text-ink-faint bg-base px-6 pt-3 font-mono text-[11px]">
                the turn failed — the ask box stays
              </p>
              <div className="bg-base px-6 py-4">
                <p className="text-stop border-stop max-w-[70ch] rounded border px-3 py-2 font-mono text-[12px] leading-5">
                  turn ended in error — sandbox provider returned 503 after 2 retries
                </p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-ink-faint font-mono text-[11px]">
                    nothing was written · the session is still open
                  </span>
                  <button
                    type="button"
                    className="text-ink rounded border border-[var(--color-line-control)] px-3.5 py-1.5 text-[13px]"
                  >
                    Ask again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Plate>

        <Specimen />
      </main>
    </div>
  );
}
