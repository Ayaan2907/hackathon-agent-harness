'use client';

import { useState } from 'react';
import { ApprovalStrip } from './_components/ApprovalStrip';
import { JobsRail } from './_components/JobsRail';
import { PersonaChip } from './_components/PersonaChip';
import { ScopeToggle } from './_components/ScopeToggle';
import type { Job, Persona, Scope } from '@/lib/council/types';

/**
 * The console shell: what the agent is doing, what it is waiting on, what it did.
 *
 * This renders the full chrome against local state. The seams where the
 * TrueForge session attaches are marked TODO and described in
 * docs/ARCHITECTURE.md.
 */
export function ConsoleClient({ personas, jobs }: { personas: Persona[]; jobs: Job[] }) {
  const [scope, setScope] = useState<Scope>('repo');
  const [selected, setSelected] = useState<string[]>(personas.map((p) => p.id));
  const [question, setQuestion] = useState('');

  function togglePersona(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-line flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold tracking-tight">Outside</span>
          <span className="text-ink-faint font-mono text-xs">council</span>
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
              {/* TODO(#2): POST /api/v1/sessions/{id}/turns via lib/harness. */}
              <button
                type="button"
                disabled={!question.trim() || selected.length === 0}
                className="bg-accent rounded-md px-3 py-1.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-30"
              >
                Ask {selected.length || 'no'} {selected.length === 1 ? 'voice' : 'voices'}
              </button>
              <span className="text-ink-faint font-mono text-xs">
                {scope === 'repo' ? 'file tools on' : 'file tools off'}
              </span>
            </div>
          </section>

          <section className="flex-1">
            <h2 className="text-ink-muted mb-3 font-mono text-xs tracking-wide uppercase">
              Stream
            </h2>
            {/* TODO(#3): render TurnStreamingEvent items from subscribeToTurn. */}
            <p className="text-ink-faint text-sm">
              Nothing yet. Turn events land here as the council answers.
            </p>
          </section>
        </main>

        <aside className="border-line w-72 shrink-0 border-l px-5 py-8">
          <JobsRail jobs={jobs} />
        </aside>
      </div>

      {/* TODO(#4): show when a tool.approval_required event arrives. */}
      <ApprovalStrip />
    </div>
  );
}
