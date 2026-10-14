import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spin } from 'antd';
import { Minus, Plus } from 'lucide-react';
import { openPdf, type PdfDocument } from '../signBlocks/pdf';
import { cn } from '../../lib/cn';

interface Props {
  /** Address of the PDF: a download link of the backend (sent with the session cookie) or a blob: address. */
  url: string;
  /** For screen readers: what document this is. */
  title: string;
  className?: string;
  /**
   * Where to put the zoom control instead of floating it over the bottom of the document: an element
   * of the caller's own toolbar. Useful when the viewer may reach below the visible part of the page.
   */
  controlsIn?: HTMLElement | null;
}

// 1 is "fit the width"; the steps the buttons move through
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
// Space left around a page inside the scrolling area
const GUTTER = 16;

/**
 * Shows a PDF with nothing around it but the pages and a zoom control: no browser toolbar, no
 * thumbnails, no print or download buttons of its own. Pages are drawn as they come into view.
 */
export default function PdfView(props: Props) {
  // Keyed by address: another document starts from scratch (first page, fit width) instead of being reset by hand
  return <Viewer key={props.url} {...props} />;
}

function Viewer({ url, title, className, controlsIn }: Props) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  // Each page's size at its natural scale, for laying the pages out before they are drawn
  const [sizes, setSizes] = useState<Array<{ width: number; height: number }>>([]);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [available, setAvailable] = useState(0);
  const [current, setCurrent] = useState(1);
  // The scrolling element, kept in state because the pages watch for scrolling inside it
  const [area, setArea] = useState<HTMLDivElement | null>(null);

  // Open the document and measure its pages
  useEffect(() => {
    let cancelled = false;
    let opened: PdfDocument | null = null;
    openPdf({ url })
      .then(async (doc) => {
        opened = doc;
        const measured = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const viewport = (await doc.getPage(n)).getViewport({ scale: 1 });
          measured.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setSizes(measured);
        setPdf(doc);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [url]);

  // Follow the width available, so "fit" stays a fit when the window or panel changes size
  useEffect(() => {
    if (!area) return;
    // The observer reports the size once straight away, then on every change
    const observer = new ResizeObserver(() => setAvailable(area.clientWidth));
    observer.observe(area);
    return () => observer.disconnect();
  }, [area]);

  const fitWidth = Math.max(available - GUTTER * 2, 120);
  const step = (direction: 1 | -1) => {
    const next = ZOOMS[ZOOMS.indexOf(zoom) + direction];
    if (next) setZoom(next);
  };
  const pill = 'flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-[#F4F4F5] disabled:pointer-events-none disabled:opacity-35';

  const controls = pdf && (
    <span className="flex items-center gap-0.5" role="toolbar" aria-label="Zoom">
      <button type="button" onClick={() => step(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out" className={pill}>
        <Minus size={15} />
      </button>
      <button
        type="button"
        onClick={() => setZoom(1)}
        title="Fit the width"
        aria-label={`Zoom ${Math.round(zoom * 100)} percent. Fit the width`}
        className="tnum min-w-14 rounded-full px-2 py-1 text-center text-[12.5px] font-semibold text-ink-2 transition-colors hover:bg-[#F4F4F5]"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={() => step(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in" className={pill}>
        <Plus size={15} />
      </button>
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      <span className="tnum pr-2 pl-1 text-[12px] text-muted" aria-live="polite">
        Page {current} of {pdf.numPages}
      </span>
    </span>
  );

  return (
    <div className={cn('relative min-h-0 bg-[#EDEDF0]', className)}>
      <div ref={setArea} className="slim-scroll absolute inset-0 overflow-auto" role="document" aria-label={title} tabIndex={0}>
        {failed ? (
          <p className="mx-auto mt-16 max-w-sm px-6 text-center text-[13px] leading-relaxed text-muted">
            This PDF could not be shown. It may be damaged or password-protected. Download it to open it another way.
          </p>
        ) : !pdf || available === 0 ? (
          <div className="grid h-full place-items-center">
            <Spin />
          </div>
        ) : (
          // w-max: when zoomed in past the width, the area scrolls sideways instead of cutting the page off
          <div className="mx-auto flex w-max min-w-full flex-col items-center gap-3" style={{ padding: GUTTER }}>
            {sizes.map((size, i) => {
              const width = Math.round(fitWidth * zoom);
              return (
                <PdfPage
                  key={i}
                  pdf={pdf}
                  pageNo={i + 1}
                  width={width}
                  height={Math.round((width * size.height) / size.width)}
                  root={area}
                  onSeen={setCurrent}
                />
              );
            })}
          </div>
        )}
      </div>

      {pdf &&
        (controlsIn !== undefined ? (
          // In the caller's toolbar: plain, because the toolbar is the frame
          controlsIn && createPortal(<div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface px-1 py-0.5">{controls}</div>, controlsIn)
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-line bg-surface/95 px-1.5 py-1 shadow-pop backdrop-blur">{controls}</div>
          </div>
        ))}
    </div>
  );
}

/** One page: a box of the right size straight away, drawn once it scrolls near the visible part. */
function PdfPage({
  pdf,
  pageNo,
  width,
  height,
  root,
  onSeen,
}: {
  pdf: PdfDocument;
  pageNo: number;
  width: number;
  height: number;
  root: HTMLElement | null;
  onSeen: (pageNo: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Draw a little before the page arrives on screen
    const nearby = new IntersectionObserver(([entry]) => setNear((was) => was || entry.isIntersecting), { root, rootMargin: '600px 0px' });
    // "Current page" is the one covering the middle of the view
    const middle = new IntersectionObserver(([entry]) => entry.isIntersecting && onSeen(pageNo), { root, rootMargin: '-49% 0px -49% 0px' });
    nearby.observe(el);
    middle.observe(el);
    return () => {
      nearby.disconnect();
      middle.disconnect();
    };
  }, [root, pageNo, onSeen]);

  useEffect(() => {
    const el = canvas.current;
    if (!near || !el) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void pdf.getPage(pageNo).then((page) => {
      if (cancelled) return;
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / natural.width) * (window.devicePixelRatio || 1) });
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      const context = el.getContext('2d');
      if (!context) return;
      task = page.render({ canvasContext: context, viewport });
      task.promise.catch(() => undefined); // a cancelled render rejects; that is expected
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNo, width, near]);

  return (
    <div ref={box} className="shrink-0 bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.14)]" style={{ width, height }}>
      {near && <canvas ref={canvas} className="block size-full" aria-label={`Page ${pageNo}`} />}
    </div>
  );
}
