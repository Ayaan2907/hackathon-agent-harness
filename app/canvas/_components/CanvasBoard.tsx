'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tldraw, createShapeId, react, type Editor, type TLRecord, type TLShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import './canvas.css';
import { CommandBar } from './CommandBar';
import {
  SESSION_WINDOW_TYPE,
  SessionWindowShapeUtil,
  type SessionWindowShape,
} from './SessionWindowShapeUtil';
import { resolveFocus } from '@/lib/canvas/focus';
import {
  addWindow,
  loadWindows,
  placeWindow,
  removeWindow,
  saveWindows,
  type SessionWindow,
} from '@/lib/canvas/layout';

const SHAPE_UTILS = [SessionWindowShapeUtil];
const NEW_WINDOW_SIZE = { w: 340, h: 240 };
/** Windows added in a row cascade instead of landing on top of each other. */
const CASCADE_STEP = 28;
const CASCADE_LENGTH = 6;

function isSessionWindow(record: TLRecord): record is SessionWindowShape {
  return record.typeName === 'shape' && record.type === SESSION_WINDOW_TYPE;
}

/** Shape ids are `shape:<window id>`, so the two are the same identity. */
function windowIdOf(shapeId: TLShapeId): string {
  return shapeId.slice('shape:'.length);
}

/**
 * The canvas: session windows you can pan, zoom, move, resize, and close, with
 * a command bar pinned over them.
 *
 * The layout in `lib/canvas/layout` is the record of which windows exist and
 * where; tldraw is the surface that edits it. Edits flow one way — tldraw
 * reports what the user did, the layout stores it, and the layout only ever
 * creates or deletes shapes, never moves them. That is what keeps a drag from
 * fighting a re-render.
 */
export function CanvasBoard() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [windows, setWindows] = useState<SessionWindow[]>(() => loadWindows(window.localStorage));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);

  useEffect(() => {
    saveWindows(window.localStorage, windows);
  }, [windows]);

  useEffect(() => {
    if (!editor) return;
    const onCanvas = new Set(
      editor.getCurrentPageShapes().filter(isSessionWindow).map((shape) => shape.id)
    );
    const wanted = new Map(windows.map((w) => [createShapeId(w.id), w] as const));

    const missing = [...wanted].filter(([id]) => !onCanvas.has(id));
    if (missing.length > 0) {
      editor.createShapes<SessionWindowShape>(
        missing.map(([id, w]) => ({
          id,
          type: SESSION_WINDOW_TYPE,
          x: w.x,
          y: w.y,
          props: { w: w.w, h: w.h, title: w.title, messages: [] },
        }))
      );
    }

    const orphans = [...onCanvas].filter((id) => !wanted.has(id));
    if (orphans.length > 0) editor.deleteShapes(orphans);
  }, [editor, windows]);

  useEffect(() => {
    if (!editor) return;
    return editor.store.listen(
      ({ changes }) => {
        setWindows((prev) => {
          let next = prev;
          for (const record of Object.values(changes.removed)) {
            if (isSessionWindow(record)) next = removeWindow(next, windowIdOf(record.id));
          }
          for (const [, after] of Object.values(changes.updated)) {
            if (isSessionWindow(after)) {
              next = placeWindow(next, windowIdOf(after.id), {
                x: after.x,
                y: after.y,
                w: after.props.w,
                h: after.props.h,
              });
            }
          }
          return next;
        });
      },
      { scope: 'document', source: 'user' }
    );
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    return react('canvas selection', () => {
      const ids = editor
        .getSelectedShapes()
        .filter(isSessionWindow)
        .map((shape) => windowIdOf(shape.id));
      setSelectedIds(ids);
      const only = ids.length === 1 ? ids[0] : undefined;
      if (only) setLastFocusedId(only);
    });
  }, [editor]);

  const focus = resolveFocus(windows, selectedIds, lastFocusedId);

  const addSessionWindow = useCallback(() => {
    if (!editor) return;
    const centre = editor.getViewportPageBounds().center;
    const id = crypto.randomUUID();
    setWindows((prev) => {
      const step = (prev.length % CASCADE_LENGTH) * CASCADE_STEP;
      return addWindow(prev, {
        id,
        title: `Session ${prev.length + 1}`,
        x: Math.round(centre.x - NEW_WINDOW_SIZE.w / 2 + step),
        y: Math.round(centre.y - NEW_WINDOW_SIZE.h / 2 + step),
        ...NEW_WINDOW_SIZE,
      });
    });
    // The shape does not exist until the next render, so point the command bar
    // at the new window directly rather than waiting to select it.
    setLastFocusedId(id);
  }, [editor]);

  const ask = useCallback(
    (question: string) => {
      if (!editor || focus.status !== 'targeted') return;
      const id = createShapeId(focus.id);
      const shape = editor.getShape<SessionWindowShape>(id);
      if (!shape) return;
      editor.updateShape<SessionWindowShape>({
        id,
        type: SESSION_WINDOW_TYPE,
        props: { messages: [...shape.props.messages, question] },
      });
    },
    [editor, focus]
  );

  return (
    <div className="fixed inset-0">
      <Tldraw shapeUtils={SHAPE_UTILS} hideUi colorScheme="dark" onMount={setEditor} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold tracking-tight">Outside</span>
          <span className="text-ink-faint font-mono text-xs">canvas</span>
          <span className="text-ink-faint font-mono text-xs">
            {windows.length} {windows.length === 1 ? 'window' : 'windows'}
          </span>
        </div>
        <button
          type="button"
          onClick={addSessionWindow}
          className="border-line bg-raised text-ink hover:border-line-strong pointer-events-auto rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          Add window
        </button>
      </div>

      <CommandBar focus={focus} onSubmit={ask} />
    </div>
  );
}
