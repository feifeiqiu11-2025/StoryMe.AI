/**
 * DrawingCanvas — full-screen drawing surface for the chapter-book editor.
 *
 * Kids who can draw don't need AI: they sketch their character directly
 * here (Apple Pencil pressure on iPad, mouse/finger elsewhere) and the
 * result is exported as a transparent PNG that flows into the same
 * "How does it look?" card as Upload — optional AI polish, never required.
 *
 * Stroke quality comes from perfect-freehand (Principle 5, Reuse Before
 * Rebuild): a tiny MIT library that turns pointer input into smooth,
 * pressure-sensitive ink outlines. We render those outlines onto a 2D
 * canvas and keep a stroke list in React state for undo/clear.
 *
 * Principle 8 (Accessible/Responsive): full-screen overlay so kids get
 * room to draw; 44px+ touch targets; touch-action:none + palm rejection
 * so a resting hand doesn't draw while the Pencil is down.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';

// A point is [x, y, pressure]. perfect-freehand reads pressure when
// thinning is enabled to taper the stroke.
type Point = [number, number, number];

export interface Stroke {
  points: Point[];
  color: string;
  size: number;
  /** Eraser strokes punch transparency via destination-out compositing. */
  erase: boolean;
}

interface DrawingCanvasProps {
  /** Seed the canvas with an existing draft so kids can resume/edit. */
  initialStrokes?: Stroke[];
  /** Canvas pixel size the initialStrokes were drawn at. Used to rescale
   *  them to the current canvas when reopening on a different-sized screen
   *  (cross-device). Omit for same-session drafts (no rescale needed). */
  initialCanvas?: { w: number; h: number };
  /** Finish: hand back the PNG, the strokes, and the canvas size they were
   *  drawn at (so a re-edit can rescale). Strokes also let the draft be
   *  reopened if Done was tapped by accident. */
  onDone: (file: File, strokes: Stroke[], canvas: { w: number; h: number }) => void;
  /** Collapse to the panel, keeping the draft (strokes + a preview image)
   *  so the kid can come back and continue drawing. */
  onMinimize: (strokes: Stroke[], previewDataUrl: string) => void;
  /** Exit and discard the drawing entirely. */
  onClose: () => void;
}

// Kid-friendly palette — a small, bold set rather than a full picker.
const PALETTE = [
  '#2b2b2b', '#e0463e', '#f5a623', '#3ba55d',
  '#4a90d9', '#9b59b6', '#f06ec0', '#8b5a2b',
];

const MIN_SIZE = 2;
const MAX_SIZE = 48;

/**
 * Map strokes from the canvas they were drawn on into a new canvas size,
 * preserving aspect ratio (uniform scale + centering). Brush size scales
 * too so thickness stays proportional. Used when reopening a saved drawing
 * on a different-sized screen.
 */
function rescaleStrokes(
  strokes: Stroke[],
  from: { w: number; h: number },
  to: { w: number; h: number }
): Stroke[] {
  const scale = Math.min(to.w / from.w, to.h / from.h);
  if (!isFinite(scale) || scale <= 0 || scale === 1) return strokes;
  const offX = (to.w - from.w * scale) / 2;
  const offY = (to.h - from.h * scale) / 2;
  return strokes.map((s) => ({
    ...s,
    size: s.size * scale,
    points: s.points.map(([x, y, p]) => [x * scale + offX, y * scale + offY, p] as Point),
  }));
}

function strokeOptions(size: number, usePressure: boolean, live: boolean) {
  return {
    size,
    thinning: usePressure ? 0.6 : 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    last: !live,
  };
}

export function DrawingCanvas({ initialStrokes, initialCanvas, onDone, onMinimize, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [color, setColor] = useState(PALETTE[0]);
  // Last color chosen from the native picker — shown as an extra swatch so
  // kids can pick any color, not just the quick presets.
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [size, setSize] = useState(14);
  const [usePressure, setUsePressure] = useState(true);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  // Stroke history lives in refs (mutated during a drag for 60fps redraws)
  // mirrored into state only for enabling/disabling Undo. Keeping the hot
  // path off React state avoids a re-render per pointermove. Seeded from
  // initialStrokes so a minimized/edited draft resumes where it left off.
  const strokesRef = useRef<Stroke[]>(initialStrokes ? initialStrokes.map((s) => ({ ...s })) : []);
  const currentRef = useRef<Stroke | null>(null);
  const [strokeCount, setStrokeCount] = useState(initialStrokes?.length ?? 0);

  const activePointerRef = useRef<number | null>(null);
  const penDownRef = useRef(false);
  // Rescale restored strokes to the current canvas exactly once (first fit).
  // Re-running on later resizes would compound the scaling.
  const rescaledRef = useRef(false);

  // ── canvas sizing (hi-dpi) ───────────────────────────────────────────
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Cross-device fix: strokes were captured in the pixel space of the
    // canvas they were drawn on. On first fit, map them into this canvas
    // (uniform scale + center) so the drawing isn't shifted or clipped.
    if (!rescaledRef.current) {
      rescaledRef.current = true;
      if (initialCanvas && initialCanvas.w > 0 && initialCanvas.h > 0) {
        strokesRef.current = rescaleStrokes(
          strokesRef.current,
          initialCanvas,
          { w: rect.width, h: rect.height }
        );
      }
    }
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke, live: boolean) => {
    const outline = getStroke(s.points, strokeOptions(s.size, usePressure, live));
    if (!outline.length) return;
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
    ctx.closePath();
    if (s.erase) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = s.color;
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }, [usePressure]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const s of strokesRef.current) drawStroke(ctx, s, false);
    if (currentRef.current) drawStroke(ctx, currentRef.current, true);
  }, [drawStroke]);

  useEffect(() => {
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    return () => window.removeEventListener('resize', fitCanvas);
  }, [fitCanvas]);

  // Redraw when a render-affecting setting changes (e.g. pressure toggle).
  useEffect(() => {
    redraw();
  }, [usePressure, redraw]);

  // Esc minimizes (never discards) so a stray keypress can't lose work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleMinimize();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── pointer handling ─────────────────────────────────────────────────
  const pointFromEvent = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    return [e.clientX - rect.left, e.clientY - rect.top, usePressure ? pressure : 0.5];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Palm rejection: once a pen is in contact, ignore touch input.
    if (e.pointerType === 'touch' && penDownRef.current) return;
    if (e.pointerType === 'pen') penDownRef.current = true;
    activePointerRef.current = e.pointerId;
    canvasRef.current?.setPointerCapture(e.pointerId);
    currentRef.current = {
      points: [pointFromEvent(e)],
      color,
      size,
      erase: tool === 'eraser',
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointerRef.current || !currentRef.current) return;
    const coalesced = e.nativeEvent.getCoalescedEvents
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent];
    for (const ev of coalesced) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pressure = (ev as PointerEvent).pressure > 0 ? (ev as PointerEvent).pressure : 0.5;
      currentRef.current.points.push([
        (ev as PointerEvent).clientX - rect.left,
        (ev as PointerEvent).clientY - rect.top,
        usePressure ? pressure : 0.5,
      ]);
    }
    redraw();
  };

  const endStroke = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointerRef.current || !currentRef.current) return;
    strokesRef.current.push(currentRef.current);
    currentRef.current = null;
    activePointerRef.current = null;
    if (e.pointerType === 'pen') penDownRef.current = false;
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = null;
    setStrokeCount(0);
    redraw();
  };

  // ── export ───────────────────────────────────────────────────────────
  // The canvas already holds the strokes on a transparent background, so
  // the exported PNG matches what the kid drew and can sit directly on a
  // book page. We also hand back the stroke list so the draft can be
  // reopened and edited (e.g. after an accidental Done).
  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dims = { w: Math.round(rect.width), h: Math.round(rect.height) };
    const strokes = strokesRef.current.map((s) => ({ ...s }));
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'my-drawing.png', { type: 'image/png' });
      onDone(file, strokes, dims);
    }, 'image/png');
  };

  // Collapse to the panel but keep the work: hand back the strokes plus a
  // small preview so the panel can show "continue drawing".
  const handleMinimize = () => {
    const canvas = canvasRef.current;
    const strokes = strokesRef.current.map((s) => ({ ...s }));
    const preview = canvas ? canvas.toDataURL('image/png') : '';
    onMinimize(strokes, preview);
  };

  // X exits and throws the drawing away. Confirm only when there's work to
  // lose, so an empty canvas closes instantly.
  const handleClose = () => {
    if (strokesRef.current.length > 0) {
      const ok = window.confirm('Throw away this drawing? Use Minimize if you want to keep it for later.');
      if (!ok) return;
    }
    onClose();
  };

  const isEmpty = strokeCount === 0 && !currentRef.current;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#faf7f1]" role="dialog" aria-modal="true" aria-label="Drawing canvas">
      {/* Single toolbar: drawing tools on the left, command actions grouped
          on the right. Title dropped and the two rows merged so the canvas
          gets the reclaimed vertical space. Wraps gracefully on narrow
          screens. */}
      <div className="flex items-center gap-x-4 gap-y-2 px-3 py-2 bg-white shadow-sm flex-wrap">
        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => { setColor(c); setTool('pen'); }}
              className={`w-8 h-8 rounded-full border-2 border-white transition-transform ${
                color === c && tool === 'pen' ? 'ring-2 ring-blue-500 scale-110' : 'ring-1 ring-black/15'
              }`}
              style={{ background: c }}
            />
          ))}

          {/* When a custom color has been picked, show it as its own swatch
              so it's one tap to reselect. */}
          {customColor && (
            <button
              type="button"
              aria-label={`Custom color ${customColor}`}
              onClick={() => { setColor(customColor); setTool('pen'); }}
              className={`w-8 h-8 rounded-full border-2 border-white transition-transform ${
                color === customColor && tool === 'pen' ? 'ring-2 ring-blue-500 scale-110' : 'ring-1 ring-black/15'
              }`}
              style={{ background: customColor }}
            />
          )}

          {/* "More colors" — opens the OS color picker (full wheel on iPad).
              The native <input type=color> fills the swatch invisibly so the
              picker anchors here; the rainbow ring signals what it does. */}
          <label
            title="More colors"
            className="relative w-8 h-8 rounded-full cursor-pointer overflow-hidden ring-1 ring-black/15 flex items-center justify-center"
            style={{ background: 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)' }}
          >
            <PlusIcon />
            <input
              type="color"
              aria-label="More colors"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setCustomColor(e.target.value);
                setTool('pen');
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>

        {/* Pen / Eraser */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('pen')}
            aria-label="Pen"
            aria-pressed={tool === 'pen'}
            title="Pen"
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
              tool === 'pen' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <PenIcon />
          </button>
          <button
            type="button"
            onClick={() => setTool('eraser')}
            aria-label="Eraser"
            aria-pressed={tool === 'eraser'}
            title="Eraser"
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
              tool === 'eraser' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <EraserIcon />
          </button>
        </div>

        {/* Brush size: brush icon → slider → live dot preview (shows the
            actual thickness + current color). */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500" aria-hidden>
            <BrushIcon />
          </span>
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Brush size"
            title="Brush size"
            className="w-24 h-2 rounded-full appearance-none bg-gray-200 accent-blue-600 cursor-pointer"
          />
          <span className="flex items-center justify-center w-7 h-7" aria-hidden>
            <span
              className="rounded-full"
              style={{
                width: `${Math.max(4, Math.min(size, 24))}px`,
                height: `${Math.max(4, Math.min(size, 24))}px`,
                background: tool === 'eraser' ? '#cbd5e1' : color,
              }}
            />
          </span>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={usePressure}
            onChange={(e) => setUsePressure(e.target.checked)}
          />
          Pencil pressure
        </label>

        {/* Command actions, top-right. Two sub-groups separated by a
            divider: canvas edits (Undo / Clear) then window actions
            (Close / Minimize / Done). Icon + label on each — Clear and
            Close are both "remove"-ish, so labels prevent confusion. */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={undo}
            disabled={strokeCount === 0}
            className="min-h-[40px] px-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1.5"
          >
            <UndoIcon /> Undo
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={isEmpty}
            className="min-h-[40px] px-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1.5"
          >
            <TrashIcon /> Clear
          </button>

          <span className="w-px h-7 bg-gray-200 mx-1.5" aria-hidden />

          <button
            type="button"
            onClick={handleClose}
            title="Close and discard this drawing"
            className="min-h-[40px] px-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 flex items-center gap-1.5"
          >
            <XIcon /> Close
          </button>
          <button
            type="button"
            onClick={handleMinimize}
            title="Keep this drawing and come back to it later"
            className="min-h-[40px] px-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 flex items-center gap-1.5"
          >
            <MinimizeIcon /> Minimize
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={isEmpty}
            className="min-h-[40px] px-4 ml-1 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <CheckIcon /> Done
          </button>
        </div>
      </div>

      {/* Canvas stage */}
      <div ref={stageRef} className="relative flex-1 m-3 rounded-xl overflow-hidden bg-white border border-gray-200 shadow-inner">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            Draw with your finger or Apple Pencil
          </p>
        )}
      </div>
    </div>
  );
}

function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" />
      <path d="M18 13.3l-6.3 -6.3" />
    </svg>
  );
}

function BrushIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.4))' }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 14 4 9 9 4" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="19" x2="19" y2="19" />
    </svg>
  );
}
