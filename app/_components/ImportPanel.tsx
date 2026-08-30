'use client';

import { useState } from 'react';

/**
 * Turns a conversation you already had into something the council can review.
 *
 * The panel is deliberately blunt about what import is. TrueForge seeds a
 * session with a single user message and has no assistant role, so an imported
 * conversation is quoted, not resumed — the council reads it as a document.
 * Saying that on the surface is cheaper than letting someone discover it when
 * the answers come back wrong.
 */

type Source = 'paste' | 'claude-code';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'paste', label: 'Paste' },
  { value: 'claude-code', label: 'Claude Code' },
];

const PLACEHOLDER: Record<Source, string> = {
  paste: '## User\n\nWhy did we pick tldraw?\n\n## Assistant\n\nBecause OpenUI is not a canvas.',
  'claude-code': 'Contents of ~/.claude/projects/<slug>/<session>.jsonl — or pick the file above.',
};

interface Seed {
  content: string;
  messageCount: number;
  truncated: boolean;
}

export function ImportPanel() {
  const [source, setSource] = useState<Source>('paste');
  const [text, setText] = useState('');
  const [seed, setSeed] = useState<Seed | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function reset() {
    setSeed(undefined);
    setError(undefined);
    setCopied(false);
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    reset();
    if (file.name.endsWith('.jsonl')) setSource('claude-code');
    setText(await file.text());
  }

  async function runImport() {
    setBusy(true);
    reset();
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source, text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(String(body.error ?? `HTTP ${res.status}`));
      setSeed(body as Seed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'import failed');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!seed) return;
    await navigator.clipboard.writeText(seed.content);
    setCopied(true);
  }

  return (
    <section className="border-line border-t px-6 py-8">
      <h2 className="text-ink-muted mb-1 font-mono text-xs tracking-wide uppercase">Import</h2>
      <p className="text-ink-faint mb-4 max-w-2xl text-sm">
        Bring in a conversation you already had — pasted markdown or JSON, or a Claude Code session
        file. It comes back as one quoted block to drop into the ask box above. The council reviews
        it as a document; it does not carry on the conversation, because a TrueForge session can
        only be seeded with a single user message and there is no assistant role.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div
          className="border-line flex rounded-md border p-0.5"
          role="radiogroup"
          aria-label="Import source"
        >
          {SOURCES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={source === option.value}
              onClick={() => {
                setSource(option.value);
                reset();
              }}
              className={
                source === option.value
                  ? 'bg-line text-ink rounded px-3 py-1 text-xs font-medium'
                  : 'text-ink-muted hover:text-ink rounded px-3 py-1 text-xs'
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <input
          type="file"
          accept=".jsonl,.json,.md,.txt"
          aria-label="Conversation file"
          onChange={(e) => loadFile(e.target.files?.[0])}
          className="text-ink-faint file:border-line file:text-ink-muted hover:file:border-line-strong max-w-xs text-xs file:mr-3 file:rounded-md file:border file:bg-transparent file:px-2 file:py-1 file:text-xs"
        />
      </div>

      <label htmlFor="import-source" className="sr-only">
        Conversation to import
      </label>
      <textarea
        id="import-source"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          reset();
        }}
        rows={5}
        placeholder={PLACEHOLDER[source]}
        className="border-line bg-raised text-ink placeholder:text-ink-faint focus:border-line-strong w-full resize-y rounded-md border px-3 py-2 font-mono text-xs outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runImport}
          disabled={!text.trim() || busy}
          className="border-line text-ink hover:border-line-strong rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? 'Importing…' : 'Import'}
        </button>
        {seed ? (
          <>
            <button
              type="button"
              onClick={copy}
              className="bg-accent rounded-md px-3 py-1.5 text-sm font-medium text-black"
            >
              {copied ? 'Copied' : 'Copy seed'}
            </button>
            <span className="text-ink-faint font-mono text-xs">
              {seed.messageCount} {seed.messageCount === 1 ? 'turn' : 'turns'} ·{' '}
              {seed.content.length} chars
              {seed.truncated ? ' · older turns dropped to fit the cap' : ''}
            </span>
          </>
        ) : null}
      </div>

      {error ? <p className="text-stop mt-3 font-mono text-xs">{error}</p> : null}

      {seed ? (
        <>
          <label htmlFor="import-seed" className="sr-only">
            Seed message
          </label>
          <textarea
            id="import-seed"
            readOnly
            value={seed.content}
            rows={8}
            className="border-line bg-raised text-ink-muted mt-4 w-full resize-y rounded-md border px-3 py-2 font-mono text-xs outline-none"
          />
        </>
      ) : null}
    </section>
  );
}
