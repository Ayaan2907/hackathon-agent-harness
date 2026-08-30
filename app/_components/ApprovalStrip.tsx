'use client';

import type { PendingVoice } from '@/lib/council/events';

/**
 * The stop line. When the agent asks for a write tool, TrueForge emits
 * `tool.approval_required` and the turn parks. Nothing irreversible happens
 * until a human answers here.
 *
 * The strip names the voices, not the call count. A council fans out and each
 * subagent parks its own write, so "3 calls" is three different reviewers each
 * wanting to record a different decision — and which reviewer it is, is the
 * whole basis for the answer.
 *
 * There is one button pair because there is one decision. The harness rejects a
 * resume that leaves any parked call unanswered — "Send batch must resolve all
 * pending tool calls awaiting user input" — so per-voice buttons would offer a
 * choice the API cannot honour.
 *
 * Resuming is not a dedicated endpoint: you create the *next* turn with a
 * `user.tool_approval` input item carrying the `tool_call_id`. See
 * docs/ARCHITECTURE.md.
 */
export function ApprovalStrip({
  voices,
  onDecide,
}: {
  voices: PendingVoice[];
  onDecide: (decision: 'allow' | 'deny') => void;
}) {
  if (voices.length === 0) return null;

  const calls = voices.reduce((n, v) => n + v.calls.length, 0);
  const many = calls > 1;

  return (
    <div
      role="alertdialog"
      aria-label="Tool approval required"
      className="border-wait bg-raised flex items-center justify-between gap-4 border-t px-6 py-4"
    >
      <div>
        <p className="text-ink text-sm">
          <span className="text-wait font-mono text-xs">waiting</span>, {many ? 'these' : 'this'}{' '}
          {many ? 'voices want' : 'voice wants'} to write to the ledger:
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {voices.map((voice) => (
            <li
              key={voice.threadId}
              className="border-line text-ink flex items-baseline gap-2 rounded-md border px-2 py-1 font-mono text-xs"
            >
              {voice.name}
              <span className="text-ink-faint">{voice.calls[0]?.toolName}</span>
              {voice.calls.length > 1 ? (
                <span className="text-ink-muted">×{voice.calls.length}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-ink-muted mt-2 text-xs">
          {many
            ? 'One decision covers all of them. The harness will not resume a turn with any call left unanswered.'
            : 'This writes to the decision ledger and cannot be undone.'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onDecide('deny')}
          className="border-line text-ink-muted hover:text-ink rounded-md border px-3 py-1.5 text-xs"
        >
          Deny{many ? ' all' : ''}
        </button>
        <button
          type="button"
          onClick={() => onDecide('allow')}
          className="bg-accent rounded-md px-3 py-1.5 text-xs font-medium text-black"
        >
          Approve{many ? ' all' : ''}
        </button>
      </div>
    </div>
  );
}
