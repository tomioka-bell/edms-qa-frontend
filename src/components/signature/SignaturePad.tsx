import { useEffect, useImperativeHandle, useRef, type PointerEvent, type Ref } from 'react';

interface Point {
  x: number;
  y: number;
}

/** What the page can ask of the pad. */
export interface SignaturePadHandle {
  /** Removes the last stroke. */
  undo: () => void;
  /** Removes everything. */
  clear: () => void;
  /** The drawing as a transparent PNG cropped to the ink, or null when nothing is drawn. */
  toBlob: () => Promise<Blob | null>;
}

interface Props {
  ref: Ref<SignaturePadHandle>;
  /** Told the number of strokes whenever it changes, so the page can enable its buttons. */
  onStrokesChange: (count: number) => void;
  disabled?: boolean;
}

const INK = '#14213d';
const PEN_WIDTH = 2.6;
// Exported at this many image pixels per screen pixel, so the signature stays sharp when printed
const EXPORT_SCALE = 3;
const EXPORT_PADDING = 10;
// The backend refuses anything larger
const EXPORT_MAX_WIDTH = 2400;
const EXPORT_MAX_HEIGHT = 1200;

/** Draws one stroke as a smooth line through its points. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Point[]) {
  if (stroke.length === 0) return;
  ctx.beginPath();
  if (stroke.length === 1) {
    // A tap leaves a dot
    ctx.arc(stroke[0].x, stroke[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(stroke[0].x, stroke[0].y);
  // Curve through the midpoints of consecutive points: follows the hand without visible corners
  for (let i = 1; i < stroke.length - 1; i += 1) {
    const mid = { x: (stroke[i].x + stroke[i + 1].x) / 2, y: (stroke[i].y + stroke[i + 1].y) / 2 };
    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, mid.x, mid.y);
  }
  const last = stroke[stroke.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function styleInk(ctx: CanvasRenderingContext2D, width: number) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/**
 * A surface to sign on with a mouse, finger or pen. Strokes are kept as points rather than pixels,
 * so undo, redrawing after a resize and a crisp high-resolution export all come from the same data.
 */
export default function SignaturePad({ ref, onStrokesChange, disabled = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<number | null>(null); // pointer id of the stroke in progress

  const redraw = () => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    styleInk(ctx, PEN_WIDTH);
    for (const stroke of strokes.current) drawStroke(ctx, stroke);
  };

  // Keep the canvas's pixel size in step with its size on screen (and the screen's pixel density)
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = el.getBoundingClientRect();
      el.width = Math.round(width * ratio);
      el.height = Math.round(height * ratio);
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    undo() {
      strokes.current = strokes.current.slice(0, -1);
      redraw();
      onStrokesChange(strokes.current.length);
    },
    clear() {
      strokes.current = [];
      redraw();
      onStrokesChange(0);
    },
    toBlob() {
      const points = strokes.current.flat();
      if (points.length === 0) return Promise.resolve(null);

      // Crop to the ink, with a little room around it
      const minX = Math.min(...points.map((p) => p.x)) - EXPORT_PADDING;
      const minY = Math.min(...points.map((p) => p.y)) - EXPORT_PADDING;
      const width = Math.max(...points.map((p) => p.x)) + EXPORT_PADDING - minX;
      const height = Math.max(...points.map((p) => p.y)) + EXPORT_PADDING - minY;
      const scale = Math.min(EXPORT_SCALE, EXPORT_MAX_WIDTH / width, EXPORT_MAX_HEIGHT / height);

      const out = document.createElement('canvas');
      out.width = Math.ceil(width * scale);
      out.height = Math.ceil(height * scale);
      const ctx = out.getContext('2d');
      if (!ctx) return Promise.resolve(null);
      ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
      styleInk(ctx, PEN_WIDTH);
      for (const stroke of strokes.current) drawStroke(ctx, stroke);
      return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    },
  }));

  const pointAt = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || drawing.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = e.pointerId;
    strokes.current = [...strokes.current, [pointAt(e)]];
    redraw();
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== e.pointerId) return;
    strokes.current[strokes.current.length - 1].push(pointAt(e));
    redraw();
  };

  const end = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== e.pointerId) return;
    drawing.current = null;
    onStrokesChange(strokes.current.length);
  };

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label="Signature drawing area"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      // touch-action none: dragging a finger here draws instead of scrolling the page
      className={`block h-56 w-full touch-none rounded-[10px] ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'}`}
    />
  );
}
