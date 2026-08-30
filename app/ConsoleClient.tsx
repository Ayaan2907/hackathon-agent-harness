'use client';

import { useState } from 'react';
import { ApprovalStrip } from './_components/ApprovalStrip';
import { JobsRail } from './_components/JobsRail';
import { PersonaChip } from './_components/PersonaChip';
import { ScopeToggle } from './_components/ScopeToggle';
import { pendingVoices } from '@/lib/council/events';
import { useCouncilStream } from '@/lib/council/useCouncilStream';
import type { Exchange } from '@/lib/council/transcript';
import type { Job, Persona, Scope } from '@/lib/council/types';

/**
 * The console shell: what the agent is doing, what it is waiting on, what it did.
 *
 * Every voice arrives on one stream and is grouped by `thread_id`, so the
 * columns below are subagent threads, not separate sessions. Every *question*
 * stays on screen, because the agent keeps the conversation and a display that
 * wiped itself each turn made that invisible.
 */

const STATUS_LABEL: Record<string, string> = {
  idle: 'idle',
  streaming: 'working',
  waiting: 'waiting on you',
  done: 'done',
  error: 'error',
};

function StatusMark({ status }: { status: Exchange['status'] }) {
  const tone =
    status === 'waiting'
      ? 'text-wait'
      : status === 'error'
        ? 'text-stop'
        : status === 'done'
          ? 'text-ok'
          : 'text-ink-faint';

  return <span className={`font-mono text-[10px] ${tone}`}>{STATUS_LABEL[status]}</span>;
}

function ExchangeBlock({ exchange }: { exchange: Exchange }) {
  // The root thread narrates delegation; the persona answers are the subagents.
  const root = exchange.threads.find((t) => t.id === 'main');
  const voices = exchange.threads.filter((t) => t.id !== 'main');

  return (
    <article className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4">
        <p className="text-ink text-sm font-medium">{exchange.question || 'Approval resumed'}</p>
        <StatusMark status={exchange.status} />
      </header>

      {exchange.error ? (
        <p className="text-stop border-stop rounded-md border px-3 py-2 font-mono text-xs">
          {exchange.error}
        </p>
      ) : null}

      {root && root.text ? (
        <details className="border-line bg-raised rounded-md border px-4 py-3">
          <summary className="text-ink-muted cursor-pointer font-mono text-xs">
            root thread — delegation
          </summary>
          <p className="text-ink-muted mt-2 text-xs whitespace-pre-wrap">{root.text}</p>
        </details>
      ) : null}

      {voices.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {voices.map((t) => (
            <section
              key={t.id}
              className="border-line bg-raised flex flex-col rounded-md border px-4 py-3"
            >
              <header className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs">{t.title}</span>
                <span className={`font-mono text-[10px] ${t.done ? 'text-ok' : 'text-wait'}`}>
                  {t.done ? 'done' : 'thinking'}
                </span>
              </header>
              <p className="text-ink text-sm whitespace-pre-wrap">{t.text}</p>
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ConsoleClient({ personas, jobs }: { personas: Persona[]; jobs: Job[] }) {
  const [scope, setScope] = useState<Scope>('repo');
  const [selected, setSelected] = useState<string[]>(personas.map((p) => p.id));
  const [question, setQuestion] = useState('');
  const { transcript, pending, status, error, ask, decide } = useCouncilStream();

  const busy = status === 'streaming' || status === 'waiting';
  const current = transcript.at(-1);

  function togglePersona(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    ask(question, scope, selected);
    setQuestion('');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-line flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold tracking-tight">Outside</span>
          <span className="text-ink-faint font-mono text-xs">council</span>
          <span
            className={`font-mono text-xs ${
              status === 'waiting'
                ? 'text-wait'
                : status === 'error'
                  ? 'text-stop'
                  : status === 'done'
                    ? 'text-ok'
                    : 'text-ink-faint'
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <ScopeToggle value={scope} onChange={setScope} />
      </header>

      <div className="flex flex-1">
        <main className="flex flex-1 flex-col gap-8 px-6 py-8">
          <section>
            <h2 className="text-ink-muted mb-3 font-mono text-xs tracking-wide uppercase">
              Council
            </h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {personas.map((p) => (
                <PersonaChip
                  key={p.id}
                  persona={p}
                  selected={selected.includes(p.id)}
                  onToggle={() => togglePersona(p.id)}
                />
              ))}
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder={
                scope === 'repo'
                  ? 'Based on my codebase, how do I proceed?'
                  : 'Irrespective of my codebase, how should I plan this?'
              }
              className="border-line bg-raised text-ink placeholder:text-ink-faint focus:border-line-strong w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
            />

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={!question.trim() || selected.length === 0 || busy}
                className="bg-accent rounded-md px-3 py-1.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-30"
              >
                Ask {selected.length || 'no'} {selected.length === 1 ? 'voice' : 'voices'}
              </button>
              <span className="text-ink-faint font-mono text-xs">
                {scope === 'repo' ? 'sandbox + ledger on' : 'no sandbox, no write tools'}
              </span>
            </div>

            {error ? <p className="text-stop mt-3 font-mono text-xs">{error}</p> : null}
          </section>

          <section className="flex-1">
            <h2 className="text-ink-muted mb-3 font-mono text-xs tracking-wide uppercase">
              Conversation
            </h2>

            {transcript.length === 0 ? (
              <p className="text-ink-faint text-sm">
                Nothing yet. Turn events land here as the council answers.
              </p>
            ) : (
              <div className="divide-line flex flex-col gap-6 divide-y">
                {transcript.map((exchange) => (
                  <ExchangeBlock key={exchange.id} exchange={exchange} />
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="border-line w-72 shrink-0 border-l px-5 py-8">
          <JobsRail jobs={jobs} />
        </aside>
      </div>

      {/*
        Only while the console is actually parked. `decide` flips the status to
        working the moment it posts, which takes the buttons away and stops a
        second click resuming the same turn twice.
      */}
      {status === 'waiting' ? (
        <ApprovalStrip voices={pendingVoices(pending, current?.threads ?? [])} onDecide={decide} />
      ) : null}
    </div>
  );
}
