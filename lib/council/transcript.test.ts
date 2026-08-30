import { describe, expect, it } from 'vitest';
import { projectTranscript, reduceTranscript, type Exchange } from './transcript';
import { HISTORY_WIRE, STREAM_EVENTS, THREAD_IDS, TURN_IDS } from './transcript.fixture';

/**
 * Seam: an event log becomes a readable conversation.
 *
 * The same projection serves both directions — live SSE folded one event at a
 * time, and a whole session rehydrated from `GET /sessions/{id}/events` — so
 * every case below is checked against captured events rather than a guess at
 * their shape. See `transcript.fixture.ts` for what the harness really sends.
 */

function ask() {
  return projectTranscript(HISTORY_WIRE);
}

describe('projectTranscript', () => {
  it('reads the wire order, which is newest event first', () => {
    // Feeding the payload as-is has to produce the conversation in the order it
    // happened. Getting this backwards is silent: every field still populates.
    expect(ask().map((e) => e.question)).toEqual([
      'Read README.md. Cut the jobs rail?',
      'Anything else?',
    ]);
  });

  it('keeps every voice in its own column', () => {
    // Threads land in the order they first speak, so the root arrives last
    // here: it delegates, waits, and only summarises once the voices are in.
    const [first] = ask();

    expect(first?.threads.map((t) => [t.id, t.text])).toEqual([
      [THREAD_IDS.shipper, 'Cut it. Ship the ask box.'],
      [THREAD_IDS.hostile, 'The rail hides a failed job. Recorded.'],
      ['main', 'They split on the rail.'],
    ]);
  });

  it('names a subagent thread after the persona that runs on it', () => {
    expect(ask()[0]?.threads.map((t) => t.title)).toEqual(['shipper', 'hostile', 'Council']);
  });

  it('marks a thread done only once the harness closes it', () => {
    // The root thread has no `thread.done` of its own — the turn ending is what
    // closes it — so it stays open while the subagents report finished.
    expect(ask()[0]?.threads.map((t) => t.done)).toEqual([true, true, false]);
  });

  it('folds an approval resume into the answer it continues', () => {
    // The harness splits one question across two turns when a write parks. The
    // reader asked once, so the transcript shows one exchange — and the resume
    // turn is what a later approval has to chain onto.
    const [first] = ask();

    expect(first?.id).toBe(TURN_IDS.ask);
    expect(first?.turnId).toBe(TURN_IDS.resume);
  });

  it('clears the approval once the resume answers it', () => {
    const [first] = ask();

    expect(first?.pending).toEqual([]);
    expect(first?.status).toBe('done');
  });

  it('reports a failed turn as an error and keeps the reason', () => {
    const last = ask().at(-1) as Exchange;

    expect(last.status).toBe('error');
    expect(last.error).toContain('401 Unauthorized');
  });

  it('projects an empty log to an empty conversation', () => {
    expect(projectTranscript([])).toEqual([]);
  });
});

describe('reduceTranscript', () => {
  function live(upTo = STREAM_EVENTS.length) {
    return STREAM_EVENTS.slice(0, upTo).reduce(reduceTranscript, [] as Exchange[]);
  }

  it('opens an exchange from the question the turn was created with', () => {
    expect(live(1)).toEqual([
      {
        id: TURN_IDS.ask,
        turnId: TURN_IDS.ask,
        question: 'Read README.md. Cut the jobs rail?',
        threads: [],
        status: 'streaming',
        pending: [],
      },
    ]);
  });

  it('keeps interleaved deltas in the thread that sent them', () => {
    // Two subagents stream at once. Buffer by anything but `thread_id` and the
    // two answers get spliced into one.
    expect(
      live()
        .at(-1)
        ?.threads.map((t) => t.text),
    ).toEqual(['Cut it.', 'The rail hides a failure.']);
  });

  it('ignores the empty model.message that opens a streamed reply', () => {
    // Live, `model.message` is a start marker with no content; in history the
    // same type carries the finished text. One branch has to serve both.
    expect(live(2).at(-1)?.threads).toEqual([]);
  });

  it('parks the exchange on the call waiting for a human', () => {
    const parked = live().at(-1) as Exchange;

    expect(parked.status).toBe('waiting');
    expect(parked.pending).toEqual([
      {
        threadId: THREAD_IDS.hostile,
        toolCallId: 'call_ledger_hostile',
        toolName: 'record_decision',
      },
    ]);
  });

  it('does not call a parked turn finished, even though the harness says done', () => {
    // `turn.done` reports `status: "done"` for a turn that only stopped to ask.
    // Trusting that field alone renders a stalled write as a completed answer.
    const done = STREAM_EVENTS.at(-1) as { state: { status: string } };

    expect(done.state.status).toBe('done');
    expect(live().at(-1)?.status).toBe('waiting');
  });
});
