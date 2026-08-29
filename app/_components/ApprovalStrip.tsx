'use client';

/**
 * The stop line. When the agent asks for a write tool, TrueForge emits
 * `tool.approval_required` and the turn parks. Nothing irreversible happens
 * until a human answers here.
 *
 * Resuming is not a dedicated endpoint: you create the *next* turn with a
 * `user.tool_approval` input item carrying the `tool_call_id`. See
 * docs/ARCHITECTURE.md.
 */
export function ApprovalStrip({
  pending,
  onDecide,
}: {
  pending?: { toolName: string; toolCallId: string; summary: string };
  onDecide: (decision: 'allow' | 'deny') => void;
}) {
  if (!pending) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Tool approval required"
      className="border-wait bg-raised flex items-center justify-between gap-4 border-t px-6 py-4"
    >
      <div>
        <p className="text-ink text-sm">
          <span className="text-wait font-mono text-xs">waiting</span>, the agent wants to run{' '}
          <span className="font-mono">{pending.toolName}</span>
        </p>
        <p className="text-ink-muted mt-1 text-xs">{pending.summary}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onDecide('deny')}
          className="border-line text-ink-muted hover:text-ink rounded-md border px-3 py-1.5 text-xs"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => onDecide('allow')}
          className="bg-accent rounded-md px-3 py-1.5 text-xs font-medium text-black"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
