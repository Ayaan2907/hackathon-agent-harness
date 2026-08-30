/**
 * Captured harness events, trimmed to the fields the projection reads.
 *
 * Both shapes were taken from `@truefoundry/trueforge@0.1.4` running locally on
 * 2026-08-29 — the SSE body of `POST /sessions/{id}/turns` and the JSON body of
 * `GET /sessions/{id}/events`. Long prompts, token usage, and ULIDs we never
 * read have been dropped; every field that survives is one the code touches.
 *
 * Three details here are the whole reason these are captures and not
 * hand-written guesses:
 *
 * 1. In a live stream `model.message` is a *start marker* and carries no
 *    content — the text arrives as `model.message.delta`. In history it is the
 *    *complete* message and carries the text, with no deltas at all.
 * 2. A turn that parks on an approval still reports `status: "done"`. The only
 *    signal that it is waiting is a non-empty `required_actions`.
 * 3. `tool.approval_required` names no function. Its `tool_calls` entries are
 *    `{ id, source_event_id }`, so the tool name has to be filled in by us.
 */

import type { SessionEventItem } from './transcript';

/** A subagent thread id. Real ones are UUIDs; these are shortened to read. */
const SHIPPER = 'thread-shipper';
const HOSTILE = 'thread-hostile';

const ASK = '01m17v7eqk4k57n9wzwrqdss7p.local';
const RESUME = '01m17v7rp9c5c1djna9yh92tx9.local';
const FOLLOW_UP = '01m17xsf6v0pekbz65z7zay3ce.local';

/**
 * One session, three harness turns, two conversational exchanges.
 *
 * The ask parks on a write the hostile voice wants to make; the resume turn
 * finishes that same answer; the follow-up question fails outright. Authored
 * oldest-first because that is the readable order — the harness returns the
 * reverse, which is what `HISTORY_WIRE` below is.
 *
 * Left unannotated on purpose. These are real payloads and still carry fields
 * the projection never reads; annotating them would force trimming the capture
 * down to what the code happens to want today, which is the opposite of the
 * point.
 */
const HISTORY_CHRONOLOGICAL = [
  {
    turn_id: ASK,
    event: {
      type: 'turn.created',
      turn_id: ASK,
      thread_id: null,
      input: [{ type: 'user.message', content: 'Read README.md. Cut the jobs rail?' }],
      state: { status: 'running' },
    },
  },
  {
    turn_id: ASK,
    event: {
      type: 'model.message',
      thread_id: 'main',
      content: null,
      tool_calls: [{ id: 'call_exec', function: { name: 'exec' } }],
    },
  },
  {
    turn_id: ASK,
    event: { type: 'tool.response', thread_id: 'main', tool_call_id: 'call_exec' },
  },
  {
    turn_id: ASK,
    event: {
      type: 'thread.created',
      thread_id: SHIPPER,
      title: 'shipper',
      agent_info: { type: 'dynamic', name: 'shipper' },
      parent: { tool_call_id: 'call_shipper', thread_id: 'main' },
    },
  },
  {
    turn_id: ASK,
    event: {
      type: 'thread.created',
      thread_id: HOSTILE,
      title: 'hostile',
      agent_info: { type: 'dynamic', name: 'hostile' },
      parent: { tool_call_id: 'call_hostile', thread_id: 'main' },
    },
  },
  {
    turn_id: ASK,
    event: { type: 'model.message', thread_id: SHIPPER, content: 'Cut it. Ship the ask box.' },
  },
  {
    turn_id: ASK,
    event: { type: 'model.message', thread_id: HOSTILE, content: 'The rail hides a failed job.' },
  },
  {
    turn_id: ASK,
    event: {
      type: 'thread.done',
      thread_id: SHIPPER,
      title: 'shipper',
      state: { status: 'done' },
    },
  },
  {
    turn_id: ASK,
    event: {
      type: 'tool.approval_required',
      thread_id: HOSTILE,
      tool_calls: [{ id: 'call_ledger_hostile', source_event_id: '01m17v41b17fqtnwhdk6zfbevc' }],
    },
  },
  {
    turn_id: ASK,
    event: {
      type: 'turn.done',
      thread_id: null,
      state: {
        status: 'done',
        output: null,
        required_actions: [
          {
            type: 'tool.approval_required',
            thread_id: HOSTILE,
            tool_calls: [{ id: 'call_ledger_hostile' }],
          },
        ],
      },
    },
  },

  {
    turn_id: RESUME,
    event: {
      type: 'turn.created',
      turn_id: RESUME,
      thread_id: null,
      input: [
        {
          type: 'user.tool_approval',
          thread_id: HOSTILE,
          tool_call_id: 'call_ledger_hostile',
          approval: { status: 'allow' },
        },
      ],
      state: { status: 'running' },
    },
  },
  {
    turn_id: RESUME,
    event: { type: 'model.message', thread_id: HOSTILE, content: ' Recorded.' },
  },
  {
    turn_id: RESUME,
    event: {
      type: 'thread.done',
      thread_id: HOSTILE,
      title: 'hostile',
      state: { status: 'done' },
    },
  },
  {
    turn_id: RESUME,
    event: { type: 'model.message', thread_id: 'main', content: 'They split on the rail.' },
  },
  {
    turn_id: RESUME,
    event: {
      type: 'turn.done',
      thread_id: null,
      state: { status: 'done', output: { content: 'They split on the rail.' } },
    },
  },

  {
    turn_id: FOLLOW_UP,
    event: {
      type: 'turn.created',
      turn_id: FOLLOW_UP,
      thread_id: null,
      input: [{ type: 'user.message', content: 'Anything else?' }],
      state: { status: 'running' },
    },
  },
  {
    turn_id: FOLLOW_UP,
    event: {
      type: 'turn.done',
      thread_id: null,
      state: {
        status: 'error',
        message:
          "Failed to connect to remote MCP server 'outside-ledger': upstream returned 401 Unauthorized",
      },
    },
  },
];

/** What `GET /sessions/{id}/events` actually returns: newest event first. */
export const HISTORY_WIRE: SessionEventItem[] = [...HISTORY_CHRONOLOGICAL].reverse();

/**
 * A live SSE turn, in arrival order.
 *
 * Two voices interleave their deltas, which is the case a per-thread buffer has
 * to survive: split the text by anything other than `thread_id` and the two
 * answers get spliced into one.
 */
export const STREAM_EVENTS = [
  {
    type: 'turn.created',
    turn_id: ASK,
    thread_id: null,
    input: [{ type: 'user.message', content: 'Read README.md. Cut the jobs rail?' }],
    state: { status: 'running' },
  },
  { type: 'model.message', thread_id: 'main' },
  {
    type: 'thread.created',
    thread_id: SHIPPER,
    title: 'shipper',
    agent_info: { type: 'dynamic', name: 'shipper' },
  },
  {
    type: 'thread.created',
    thread_id: HOSTILE,
    title: 'hostile',
    agent_info: { type: 'dynamic', name: 'hostile' },
  },
  { type: 'model.message', thread_id: SHIPPER },
  { type: 'model.message.delta', thread_id: SHIPPER, content: 'Cut' },
  { type: 'model.message.delta', thread_id: HOSTILE, content: 'The rail' },
  { type: 'model.message.delta', thread_id: SHIPPER, content: ' it.' },
  { type: 'model.message.delta', thread_id: HOSTILE, content: ' hides a failure.' },
  { type: 'thread.done', thread_id: SHIPPER, title: 'shipper', state: { status: 'done' } },
  {
    type: 'tool.approval_required',
    thread_id: HOSTILE,
    tool_calls: [{ id: 'call_ledger_hostile', source_event_id: '01m17v41b17fqtnwhdk6zfbevc' }],
  },
  {
    type: 'turn.done',
    thread_id: null,
    state: {
      status: 'done',
      output: null,
      required_actions: [
        {
          type: 'tool.approval_required',
          thread_id: HOSTILE,
          tool_calls: [{ id: 'call_ledger_hostile' }],
        },
      ],
    },
  },
];

export const THREAD_IDS = { shipper: SHIPPER, hostile: HOSTILE };
export const TURN_IDS = { ask: ASK, resume: RESUME, followUp: FOLLOW_UP };
