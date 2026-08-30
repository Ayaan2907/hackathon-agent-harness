'use client';

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  resizeBox,
  T,
  type RecordProps,
  type TLResizeInfo,
  type TLShape,
} from 'tldraw';

export const SESSION_WINDOW_TYPE = 'session-window';

/**
 * A session window on the canvas: title bar, body, close control.
 *
 * The body is a placeholder. Track B replaces it with the session's turns; this
 * shape deliberately knows nothing about the harness.
 */
export interface SessionWindowProps {
  w: number;
  h: number;
  title: string;
  messages: string[];
}

// How tldraw v5 learns about a custom shape: augment the props map, then read
// the shape type back out of TLShape.
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'session-window': SessionWindowProps;
  }
}

export type SessionWindowShape = Extract<TLShape, { type: 'session-window' }>;

export const MIN_WINDOW_SIZE = 200;

export class SessionWindowShapeUtil extends BaseBoxShapeUtil<SessionWindowShape> {
  static override type = SESSION_WINDOW_TYPE;

  static override props: RecordProps<SessionWindowShape> = {
    w: T.number,
    h: T.number,
    title: T.string,
    messages: T.arrayOf(T.string),
  };

  override getDefaultProps(): SessionWindowShape['props'] {
    return { w: 340, h: 240, title: 'Session', messages: [] };
  }

  // The window is a container, not a drawing. Nothing inside it is editable by
  // tldraw's text tools, and it should not snap to or bind with other shapes.
  override canEdit() {
    return false;
  }

  override canBind() {
    return false;
  }

  // resizeBox does the position maths a clamped resize needs; doing it by hand
  // drifts the window when it hits the minimum.
  override onResize(shape: SessionWindowShape, info: TLResizeInfo<SessionWindowShape>) {
    return resizeBox(shape, info, { minWidth: MIN_WINDOW_SIZE, minHeight: MIN_WINDOW_SIZE });
  }

  override getIndicatorPath(shape: SessionWindowShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  override component(shape: SessionWindowShape) {
    const { title, messages } = shape.props;
    return (
      <HTMLContainer style={{ pointerEvents: 'none' }}>
        <div className="border-line bg-raised flex h-full w-full flex-col overflow-hidden rounded-lg border">
          <div className="border-line flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <span className="text-ink truncate text-xs font-medium">{title}</span>
            <button
              type="button"
              aria-label={`Close ${title}`}
              style={{ pointerEvents: 'all' }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => this.editor.deleteShape(shape.id)}
              className="text-ink-faint hover:text-stop shrink-0 px-1 font-mono text-sm leading-none"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-hidden px-3 py-2">
            {messages.length === 0 ? (
              <p className="text-ink-faint text-xs">
                Nothing asked yet. Select this window and use the bar below.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {messages.map((message, index) => (
                  <li key={index} className="text-ink-muted text-xs leading-snug">
                    <span className="text-ink-faint mr-1.5 font-mono">&rsaquo;</span>
                    {message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </HTMLContainer>
    );
  }
}
