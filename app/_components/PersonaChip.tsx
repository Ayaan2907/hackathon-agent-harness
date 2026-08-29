'use client';

import type { Persona } from '@/lib/council/types';

export function PersonaChip({
  persona,
  selected,
  onToggle,
}: {
  persona: Persona;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      title={persona.stance}
      className={
        selected
          ? 'border-line-strong bg-raised text-ink rounded-md border px-3 py-1.5 text-left text-xs'
          : 'border-line text-ink-muted hover:text-ink rounded-md border px-3 py-1.5 text-left text-xs'
      }
    >
      <span className="font-medium">{persona.name}</span>
      {persona.origin === 'built' && (
        <span className="text-ink-faint ml-2 font-mono text-[10px]">built</span>
      )}
    </button>
  );
}
