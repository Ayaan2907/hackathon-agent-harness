'use client';

import type { Scope } from '@/lib/council/types';

const OPTIONS: { value: Scope; label: string }[] = [
  { value: 'repo', label: 'This repo' },
  { value: 'plan', label: 'Plan only' },
];

/**
 * Picks how the council is allowed to reason. `repo` lets the agent read the
 * sandbox and cite files; `plan` strips the file tools so answers cannot lean
 * on the codebase.
 */
export function ScopeToggle({
  value,
  onChange,
}: {
  value: Scope;
  onChange: (next: Scope) => void;
}) {
  return (
    <div className="border-line flex rounded-md border p-0.5" role="radiogroup" aria-label="Scope">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={
            value === option.value
              ? 'bg-line text-ink rounded px-3 py-1 text-xs font-medium'
              : 'text-ink-muted hover:text-ink rounded px-3 py-1 text-xs'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
