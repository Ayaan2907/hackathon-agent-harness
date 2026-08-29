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

interface Seed {
  content: string;
  messageCount: number;
  truncated: boolean;
}

export function ImportPanel() {
  const [text, setText] = useState('');
  const [seed, setSeed] = useState<Seed | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function importText() {
    setBusy(true);
    setError(undefined);
    setSeed(undefined);
    setCopied(false);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
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
        Paste a conversation — markdown, or a JSON dump. It comes back as one quoted block you can
        drop into the ask box above. The council reads it as a document and reviews it; it does not
        continue the conversation, because a session can only be seeded with a single user message.
      </p>

      <label htmlFor="import-source" className="sr-only">
        Conversation to import
      </label>
      <textarea
        id="import-source"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="## User&#10;&#10;Why did we pick tldraw?&#10;&#10;## Assistant&#10;&#10;Because OpenUI is not a canvas."
        className="border-line bg-raised text-ink placeholder:text-ink-faint focus:border-line-strong w-full resize-y rounded-md border px-3 py-2 font-mono text-xs outline-none"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={importText}
          disabled={!text.trim() || busy}
          className="border-line text-ink hover:border-line-strong rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? 'Importing…' : 'Import'}
        </button>
        {seed ? (
          <button
            type="button"
            onClick={copy}
            className="bg-accent rounded-md px-3 py-1.5 text-sm font-medium text-black"
          >
            {copied ? 'Copied' : 'Copy seed'}
          </button>
        ) : null}
        {seed ? (
          <span className="text-ink-faint font-mono text-xs">
            {seed.messageCount} {seed.messageCount === 1 ? 'turn' : 'turns'} · {seed.content.length}{' '}
            chars
            {seed.truncated ? ' · older turns dropped to fit the cap' : ''}
          </span>
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
