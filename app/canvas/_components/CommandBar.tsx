'use client';

import { useState } from 'react';
import type { Focus } from '@/lib/canvas/focus';

const NO_TARGET_LABEL: Record<'no-windows' | 'ambiguous', string> = {
  'no-windows': 'add a window first',
  ambiguous: 'select one window',
};

/**
 * The bar pinned over the canvas. It always shows which window it is about to
 * type into, and refuses to send when that answer is not a single window.
 */
export function CommandBar({
  focus,
  onSubmit,
}: {
  focus: Focus;
  onSubmit: (question: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const targeted = focus.status === 'targeted';
  const canSend = targeted && question.trim().length > 0;

  function send() {
    if (!canSend) return;
    onSubmit(question.trim());
    setQuestion('');
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="border-line bg-raised pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-xl border px-3 py-2 shadow-2xl shadow-black/40"
      >
        <span
          aria-live="polite"
          className={
            targeted
              ? 'border-line-strong text-ink shrink-0 rounded-md border px-2 py-1 font-mono text-[11px]'
              : 'border-line text-ink-faint shrink-0 rounded-md border border-dashed px-2 py-1 font-mono text-[11px]'
          }
        >
          {targeted ? focus.title : NO_TARGET_LABEL[focus.reason]}
        </span>

        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={targeted ? `Ask ${focus.title}...` : 'Nowhere to send this yet'}
          aria-label="Question for the focused window"
          className="text-ink placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-sm outline-none"
        />

        <button
          type="submit"
          disabled={!canSend}
          className="bg-accent shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-30"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
