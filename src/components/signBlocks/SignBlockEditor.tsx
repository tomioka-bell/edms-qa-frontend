import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { App as AntApp, Input, Modal, Segmented, Select, Spin, Switch, Tooltip } from 'antd';
import { CalendarCheck2, CalendarDays, Scaling, ChevronLeft, ChevronRight, Copy, CopyPlus, Magnet, MousePointerClick, Plus, SquareDashedMousePointer, Stamp, TextCursorInput, Trash2, X } from 'lucide-react';
import { openPdf, type PdfDocument } from './pdf';
import { signerColor, signerKey, type BlockField, type EditableBlock, type EditorContent, type EditorFile, type FieldType, type Signer } from './types';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Props {
  open: boolean;
  /** The PDFs of the document. */
  files: EditorFile[];
  /** Whose signatures need a place: the issuer and each step of the approval template. */
  signers: Signer[];
  blocks: EditableBlock[];
  onClose: () => void;
  /** Called with the new layout when the user confirms. */
  onSave: (blocks: EditableBlock[]) => void;
  /** Wording for uses other than laying out a template; the defaults describe that. */
  text?: EditorText;
  /** Also offer field blocks: places the signer types into (what a supplier fills in). */
  fields?: boolean;
}

/** The words at the top and on the confirm button. */
export interface EditorText {
  eyebrow: string;
  title: string;
  hint: string;
  confirm: string;
}

const TEMPLATE_TEXT: EditorText = {
  eyebrow: 'Signature Blocks',
  title: 'Place the signature blocks',
  hint: 'Add a block for each signer, then drag it onto the empty box printed in the document and pull its corner to fit.',
  confirm: 'Use this layout',
};

// A new block: roughly the size of one cell of a printed signature table
const NEW_WIDTH = 0.10;
const NEW_HEIGHT = 0.025;
// A date box is a single short line
const NEW_DATE_WIDTH = 0.10;
const NEW_FIELD_WIDTH = 0.22;
// The seal is a little wider than tall, as the company's stamp is
const NEW_SEAL_WIDTH = 0.14;
const NEW_SEAL_HEIGHT = 0.07;
const NEW_DATE_HEIGHT = 0.025;
// The space left between a signature and the date added with it, as a fraction of the page height
const PAIR_GAP = 0.002;
// How far outside a signature-and-date pair its outline is drawn, in pixels: far enough that the
// pair's corner never sits on top of a block's own corner
const PAIR_MARGIN = 14;
// How a date block will read once signed, so the block can be sized to it
const DATE_EXAMPLE = dayjs().format('DD-MMM-YY');
const MIN_SIZE = 0.02;
// The backend's limit on blocks in one document
const MAX_BLOCKS = 300;
// Two blocks this close together count as the same place, so copying twice does not stack duplicates
const SAME_PLACE = 0.004;

// How close, in screen pixels, a block's edge or centre must come to another's before it snaps onto it
const SNAP_PX = 6;
// Positions closer than this (as a fraction of the page) count as lined up
const ALIGNED = 0.0005;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** A line drawn while dragging to show what the block has lined up with. Fractions of the page. */
interface Guide {
  /** 'x': a vertical line at x = at. 'y': a horizontal line at y = at. */
  axis: 'x' | 'y';
  at: number;
  /** Where the line starts and ends along the other axis */
  from: number;
  to: number;
}

type Box = Pick<EditableBlock, 'x' | 'y' | 'width' | 'height'>;

// The three places on a box that other boxes line up with, along each axis: start, middle, end
const marksX = (b: Box) => [b.x, b.x + b.width / 2, b.x + b.width];
const marksY = (b: Box) => [b.y, b.y + b.height / 2, b.y + b.height];

/**
 * The smallest shift that brings one of `points` onto one of `targets`, when one is within `reach`.
 * Returns the shift and the target it lands on, or null when nothing is close enough.
 */
function nearestSnap(points: number[], targets: number[], reach: number): { shift: number; at: number } | null {
  let best: { shift: number; at: number } | null = null;
  for (const point of points) {
    for (const target of targets) {
      const shift = target - point;
      if (Math.abs(shift) <= reach && (best === null || Math.abs(shift) < Math.abs(best.shift))) best = { shift, at: target };
    }
  }
  return best;
}

/**
 * The guide lines to draw for a box that has come to rest at `at` on one axis: one line, long
 * enough to reach every other box that shares that line. The page's own centre line runs the
 * whole page.
 */
function guideFor(axis: 'x' | 'y', at: number, moving: Box, others: Box[]): Guide {
  if (Math.abs(at - 0.5) < ALIGNED && !others.some((o) => (axis === 'x' ? marksX(o) : marksY(o)).some((m) => Math.abs(m - at) < ALIGNED))) {
    return { axis, at, from: 0, to: 1 };
  }
  const sharing = others.filter((o) => (axis === 'x' ? marksX(o) : marksY(o)).some((m) => Math.abs(m - at) < ALIGNED));
  const all = [moving, ...sharing];
  // A vertical line runs from the topmost of them to the lowest; a horizontal one from leftmost to rightmost
  const from = Math.min(...all.map((b) => (axis === 'x' ? b.y : b.x)));
  const to = Math.max(...all.map((b) => (axis === 'x' ? b.y + b.height : b.x + b.width)));
  return { axis, at, from, to };
}

const samePlace = (a: EditableBlock, b: EditableBlock) =>
  Math.abs(a.x - b.x) < SAME_PLACE &&
  Math.abs(a.y - b.y) < SAME_PLACE &&
  Math.abs(a.width - b.width) < SAME_PLACE &&
  Math.abs(a.height - b.height) < SAME_PLACE;

/** Places, moves and resizes signature blocks on the pages of a document's PDFs. */
export default function SignBlockEditor({ open, files, signers, blocks, onClose, onSave, text = TEMPLATE_TEXT, fields = false }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1240px, calc(100vw - 32px))"
      centered
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog: every opening starts from the layout passed in, and Cancel simply drops the edits */}
      <Editor files={files} signers={signers} initial={blocks} onClose={onClose} onSave={onSave} text={text} fields={fields} />
    </Modal>
  );
}

function Editor({
  files,
  signers,
  initial,
  onClose,
  onSave,
  text,
  fields,
}: {
  files: EditorFile[];
  signers: Signer[];
  initial: EditableBlock[];
  onClose: () => void;
  onSave: (blocks: EditableBlock[]) => void;
  text: EditorText;
  fields: boolean;
}) {
  const { message } = AntApp.useApp();
  const [blocks, setBlocks] = useState<EditableBlock[]>(initial);
  const [fileKey, setFileKey] = useState(files[0]?.key ?? '');
  const [pageNo, setPageNo] = useState(1);
  // The blocks being worked on. Several can be selected at once and are then moved, copied or removed together.
  const [selected, setSelected] = useState<string[]>([]);
  // Lines shown while a drag has a block lined up with another block or the middle of the page
  const [guides, setGuides] = useState<Guide[]>([]);
  const nextKey = useRef(0);

  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  const stage = useRef<HTMLDivElement>(null); // the scrolling area, whose width the page is fitted to
  const canvas = useRef<HTMLCanvasElement>(null);
  const page = useRef<HTMLDivElement>(null); // same box as the canvas; blocks are positioned inside it

  const file = files.find((f) => f.key === fileKey) ?? null;
  const pageCount = pdf?.numPages ?? 0;
  const onPage = blocks.filter((b) => b.fileKey === fileKey && b.pageNo === pageNo);
  const selectedOnPage = onPage.filter((b) => selected.includes(b.key));

  const newKey = () => {
    nextKey.current += 1;
    return `new-${Date.now()}-${nextKey.current}`;
  };

  // Open the chosen file
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let opened: PdfDocument | null = null;
    setPdf(null);
    setPdfError(null);
    setPageSize(null);
    openPdf(file.source)
      .then((doc) => {
        if (cancelled) {
          void doc.destroy();
          return;
        }
        opened = doc;
        setPdf(doc);
      })
      .catch(() => {
        if (!cancelled) setPdfError('This PDF could not be opened. It may be damaged or password-protected.');
      });
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
    // Reopen only when a different file is chosen, not when the list is rebuilt around the same one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  // Draw the current page, fitted to the width available
  useEffect(() => {
    const el = canvas.current;
    const area = stage.current;
    if (!pdf || !el || !area) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;

    const draw = async () => {
      const pdfPage = await pdf.getPage(clamp(pageNo, 1, pdf.numPages));
      if (cancelled) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const width = Math.min(area.clientWidth - 32, 900);
      const scale = width / natural.width;
      const ratio = window.devicePixelRatio || 1;
      const viewport = pdfPage.getViewport({ scale: scale * ratio });
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      setPageSize({ width, height: natural.height * scale });
      const context = el.getContext('2d');
      if (!context) return;
      task?.cancel();
      task = pdfPage.render({ canvasContext: context, viewport });
      await task.promise.catch(() => undefined); // a cancelled render rejects; that is expected
    };
    void draw();

    const observer = new ResizeObserver(() => void draw());
    observer.observe(area);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
    };
  }, [pdf, pageNo]);

  const removeSelected = () => {
    setBlocks((list) => list.filter((b) => !selected.includes(b.key)));
    setSelected([]);
  };

  const selectAllOnPage = () => setSelected(onPage.map((b) => b.key));

  // Keyboard: Delete removes the selection, Ctrl/Cmd+A selects everything on the page, Escape lets go
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length > 0) {
        e.preventDefault();
        setBlocks((list) => list.filter((b) => !selected.includes(b.key)));
        setSelected([]);
      } else if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelected(blocks.filter((b) => b.fileKey === fileKey && b.pageNo === pageNo).map((b) => b.key));
      } else if (e.key === 'Escape') {
        setSelected([]);
      } else if (e.key.startsWith('Arrow') && selected.length > 0 && pageSize) {
        // Arrow keys move the selection one screen pixel at a time (ten with Shift), for the last fine adjustment
        e.preventDefault();
        const pixels = e.shiftKey ? 10 : 1;
        const dx = (e.key === 'ArrowLeft' ? -pixels : e.key === 'ArrowRight' ? pixels : 0) / pageSize.width;
        const dy = (e.key === 'ArrowUp' ? -pixels : e.key === 'ArrowDown' ? pixels : 0) / pageSize.height;
        setBlocks((list) =>
          list.map((b) => (selected.includes(b.key) ? { ...b, x: clamp(b.x + dx, 0, 1 - b.width), y: clamp(b.y + dy, 0, 1 - b.height) } : b)),
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, blocks, fileKey, pageNo, pageSize]);

  const goToPage = (next: number) => {
    setPageNo(next);
    setSelected([]);
    stage.current?.scrollTo({ top: 0 });
  };

  const add = (signer: Signer, content: EditorContent = 'SIGNATURE', field?: BlockField) => {
    // A field holds a line of typing: wider than a date
    const width = content === 'SEAL' ? NEW_SEAL_WIDTH : content === 'FIELD' ? NEW_FIELD_WIDTH : content === 'DATE' ? NEW_DATE_WIDTH : NEW_WIDTH;
    const height = content === 'SEAL' ? NEW_SEAL_HEIGHT : content === 'SIGNATURE' ? NEW_HEIGHT : NEW_DATE_HEIGHT;
    if (!file || !pdf) return;
    if (blocks.length >= MAX_BLOCKS) {
      message.warning(`A document can have at most ${MAX_BLOCKS} signature blocks.`);
      return;
    }
    // A page is usually taller than the window, so put the new block in the middle of the part
    // that is on screen now, not the middle of the whole page where it may be out of sight.
    const pageBox = page.current?.getBoundingClientRect();
    const view = stage.current?.getBoundingClientRect();
    let centreY = 0.5;
    if (pageBox && view && pageBox.height > 0) {
      const top = Math.max(pageBox.top, view.top);
      const bottom = Math.min(pageBox.bottom, view.bottom);
      centreY = ((top + bottom) / 2 - pageBox.top) / pageBox.height;
    }
    // Each new block lands a little lower-right of the last, so several added in a row do not hide each other
    const offset = (onPage.length % 6) * 0.025;
    const block: EditableBlock = {
      key: newKey(),
      fileKey,
      signerKind: signer.kind,
      stepNo: signer.stepNo,
      content,
      field,
      pageNo,
      x: clamp(0.5 - width / 2 + offset, 0, 1 - width),
      y: clamp(centreY - height / 2 + offset, 0, 1 - height),
      width,
      height,
    };
    setBlocks((list) => [...list, block]);
    setSelected([block.key]);
  };

  /** Adds a place the signer types into. It starts with a numbered label, to be renamed straight away. */
  const addField = (signer: Signer, type: FieldType) => {
    const count = blocks.filter((b) => b.content === 'FIELD').length;
    add(signer, 'FIELD', { label: type === 'DATE' ? `Date ${count + 1}` : `Field ${count + 1}`, type, required: true });
  };

  const patchField = (key: string, patch: Partial<BlockField>) => {
    setBlocks((list) => list.map((b) => (b.key === key && b.field ? { ...b, field: { ...b.field, ...patch } } : b)));
  };

  /**
   * Adds a signature with its date underneath, tied together: pressing either picks up both, so the
   * two are dragged into place as one and keep their spacing. Each can still be resized on its own;
   * the date stays under the signature when the signature is.
   */
  const addPair = (signer: Signer) => {
    if (!file || !pdf) return;
    if (blocks.length + 2 > MAX_BLOCKS) {
      message.warning(`A document can have at most ${MAX_BLOCKS} signature blocks.`);
      return;
    }
    const pageBox = page.current?.getBoundingClientRect();
    const view = stage.current?.getBoundingClientRect();
    let centreY = 0.5;
    if (pageBox && view && pageBox.height > 0) {
      const top = Math.max(pageBox.top, view.top);
      const bottom = Math.min(pageBox.bottom, view.bottom);
      centreY = ((top + bottom) / 2 - pageBox.top) / pageBox.height;
    }
    const offset = (onPage.length % 6) * 0.025;
    const pairHeight = NEW_HEIGHT + PAIR_GAP + NEW_DATE_HEIGHT;
    const x = clamp(0.5 - NEW_WIDTH / 2 + offset, 0, 1 - NEW_WIDTH);
    const y = clamp(centreY - pairHeight / 2 + offset, 0, 1 - pairHeight);
    const pairId = newKey();
    const common = { fileKey, signerKind: signer.kind, stepNo: signer.stepNo, pageNo, pairId };
    const pair: EditableBlock[] = [
      { ...common, key: newKey(), content: 'SIGNATURE', x, y, width: NEW_WIDTH, height: NEW_HEIGHT },
      // The date sits centred under the signature
      { ...common, key: newKey(), content: 'DATE', x: x + (NEW_WIDTH - NEW_DATE_WIDTH) / 2, y: y + NEW_HEIGHT + PAIR_GAP, width: NEW_DATE_WIDTH, height: NEW_DATE_HEIGHT },
    ];
    setBlocks((list) => [...list, ...pair]);
    setSelected(pair.map((b) => b.key));
  };

  // What a copy takes: the selected blocks, or every block on the page when nothing is selected
  const copySource = selectedOnPage.length > 0 ? selectedOnPage : onPage;

  /**
   * Puts copies of the source blocks on other pages of this file, at the same positions. A page that
   * already has the same signer's block in the same place is left alone, so copying twice adds nothing.
   * The copies are ordinary blocks: each page can then be adjusted on its own.
   */
  const copyToPages = (pages: number[]) => {
    const copies: EditableBlock[] = [];
    for (const target of pages) {
      for (const source of copySource) {
        const already = [...blocks, ...copies].some(
          (b) => b.fileKey === fileKey && b.pageNo === target && signerKey(b) === signerKey(source) && b.content === source.content && samePlace(b, source),
        );
        if (!already) copies.push({ ...source, key: newKey(), pageNo: target });
      }
    }
    if (copies.length === 0) {
      message.info('Those pages already have these blocks.');
      return [];
    }
    if (blocks.length + copies.length > MAX_BLOCKS) {
      message.warning(
        `That would make ${blocks.length + copies.length} blocks; a document can have at most ${MAX_BLOCKS}. Copy fewer blocks or to fewer pages.`,
      );
      return [];
    }
    setBlocks((list) => [...list, ...copies]);
    return copies;
  };

  const copyToAllPages = () => {
    const others = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => n !== pageNo);
    const copies = copyToPages(others);
    if (copies.length === 0) return;
    const pagesTouched = new Set(copies.map((c) => c.pageNo)).size;
    message.success(
      `Copied ${copySource.length} ${copySource.length === 1 ? 'block' : 'blocks'} to ${pagesTouched} other ${pagesTouched === 1 ? 'page' : 'pages'}. Open a page to adjust it.`,
    );
  };

  /** Copies to the next page and goes there with the copies selected, ready to be dragged into place as a group. */
  const copyToNextPage = () => {
    const copies = copyToPages([pageNo + 1]);
    setPageNo(pageNo + 1);
    stage.current?.scrollTo({ top: stage.current.scrollTop }); // stay at the same height: the boxes are usually in the same area
    if (copies.length > 0) {
      setSelected(copies.map((c) => c.key));
      message.success(`Copied ${copies.length} ${copies.length === 1 ? 'block' : 'blocks'} to page ${pageNo + 1}. Drag them into place.`);
    } else {
      // Already there: select the ones in the same places so they can be adjusted straight away
      setSelected(
        blocks
          .filter((b) => b.fileKey === fileKey && b.pageNo === pageNo + 1 && copySource.some((s) => signerKey(s) === signerKey(b) && samePlace(s, b)))
          .map((b) => b.key),
      );
    }
  };

  // The drag in progress, if any. Kept in a ref because nothing is drawn from it.
  //  - move: every selected block travels together; `origins` are where they started.
  //  - resize: a corner follows the pointer. `origins` are the blocks that change size with it, as
  //    they were at the start: one block (its own corner), or a signature and its date (the pair's corner).
  //    `follower` is the date tied to a signature being sized on its own: it keeps its size and stays under it.
  const drag = useRef<
    | { mode: 'move'; startX: number; startY: number; origins: EditableBlock[] }
    | { mode: 'resize'; key: string; grabX: number; grabY: number; origins: EditableBlock[]; follower?: EditableBlock }
    | null
  >(null);

  /** Where the pointer is on the page, as fractions of the page. Read fresh each time, so it stays right while the page scrolls. */
  const pointerOnPage = (e: PointerEvent<HTMLElement>) => {
    const box = page.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };

  /** Pointer down on a block: adjusts the selection, then starts moving whatever is selected. */
  const pressBlock = (e: PointerEvent<HTMLElement>, block: EditableBlock) => {
    const at = pointerOnPage(e);
    if (!at) return;
    e.preventDefault();
    e.stopPropagation();

    // Shift / Ctrl / Cmd adds the block to the selection or takes it out, without starting a move
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelected((keys) => (keys.includes(block.key) ? keys.filter((k) => k !== block.key) : [...keys, block.key]));
      return;
    }
    // Pressing a block that is part of the selection keeps the group; pressing any other block selects just that one
    // A signature and the date added with it are picked up together
    const tied = block.pairId ? onPage.filter((b) => b.pairId === block.pairId) : [block];
    const group = selected.includes(block.key) ? onPage.filter((b) => selected.includes(b.key)) : tied;
    if (!selected.includes(block.key)) setSelected(tied.map((b) => b.key));

    // Captured, so the drag keeps following the pointer even when it leaves the block
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: 'move', startX: at.x, startY: at.y, origins: group };
  };

  const pressResizeHandle = (e: PointerEvent<HTMLElement>, block: EditableBlock) => {
    const at = pointerOnPage(e);
    if (!at) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // A block's own corner sizes that block alone (a signature and its date have a corner of their own for both)
    // The date tied to a signature keeps its own size, but goes along so it stays where it was under the signature
    const follower = block.content === 'SIGNATURE' && block.pairId ? onPage.find((b) => b.pairId === block.pairId && b.key !== block.key) : undefined;
    drag.current = {
      mode: 'resize',
      key: block.key,
      grabX: at.x - (block.x + block.width),
      grabY: at.y - (block.y + block.height),
      origins: [block],
      follower,
    };
    // Keep the selection when the block is part of it, so a signature and its date stay picked up together
    if (!selected.includes(block.key)) setSelected([block.key]);
  };

  /** Pointer down on the corner of a signature-and-date pair: both are sized together from there. */
  const pressPairHandle = (e: PointerEvent<HTMLElement>, pair: EditableBlock[]) => {
    const at = pointerOnPage(e);
    if (!at) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const right = Math.max(...pair.map((b) => b.x + b.width));
    const bottom = Math.max(...pair.map((b) => b.y + b.height));
    drag.current = { mode: 'resize', key: '', grabX: at.x - right, grabY: at.y - bottom, origins: pair };
  };

  const continueDrag = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const at = pointerOnPage(e);
    if (!d || !at) return;

    // Near the top or bottom edge of the view, scroll the page along so blocks can be carried
    // to a part of the page that was out of sight when the drag began.
    const view = stage.current;
    if (view) {
      const rect = view.getBoundingClientRect();
      if (e.clientY > rect.bottom - 40) view.scrollTop += 16;
      else if (e.clientY < rect.top + 40) view.scrollTop -= 16;
    }

    // Snapping: an edge or the centre that comes close to another block's, or to the middle of the
    // page, jumps onto it, and a line shows what it lined up with. Holding Alt turns it off.
    const snapping = !e.altKey && pageSize !== null;
    const reachX = snapping ? SNAP_PX / pageSize.width : 0;
    const reachY = snapping ? SNAP_PX / pageSize.height : 0;
    const moving = d.origins.map((o) => o.key);
    if (d.mode === 'resize' && d.follower) moving.push(d.follower.key);
    const others = onPage.filter((b) => !moving.includes(b.key));
    const lines: Guide[] = [];

    if (d.mode === 'resize' && d.origins.length > 1) {
      // A signature and its date sized as one, from the corner of the pair: they scale about the
      // pair's top-left corner, so they keep their arrangement.
      const left = Math.min(...d.origins.map((o) => o.x));
      const top = Math.min(...d.origins.map((o) => o.y));
      const right = Math.max(...d.origins.map((o) => o.x + o.width));
      const bottom = Math.max(...d.origins.map((o) => o.y + o.height));
      // Where the pulled corner is asked to go, lined up with the other blocks when it comes close
      let cornerX = at.x - d.grabX;
      let cornerY = at.y - d.grabY;
      if (snapping) {
        const snapX = nearestSnap([cornerX], [...others.flatMap(marksX), 0.5], reachX);
        if (snapX) cornerX = snapX.at;
        const snapY = nearestSnap([cornerY], [...others.flatMap(marksY), 0.5], reachY);
        if (snapY) cornerY = snapY.at;
      }
      // How much the group stretches each way: no block smaller than the minimum, none past the page edge
      const scaleX = clamp((cornerX - left) / (right - left), Math.max(...d.origins.map((o) => MIN_SIZE / o.width)), (1 - left) / (right - left));
      const scaleY = clamp((cornerY - top) / (bottom - top), Math.max(...d.origins.map((o) => MIN_SIZE / o.height)), (1 - top) / (bottom - top));
      const sized = d.origins.map((o) => ({
        ...o,
        x: left + (o.x - left) * scaleX,
        y: top + (o.y - top) * scaleY,
        width: o.width * scaleX,
        height: o.height * scaleY,
      }));
      if (snapping) {
        // The outline of the pair as it now stands: its right and bottom edges are what moved
        const pulled = { x: left, y: top, width: (right - left) * scaleX, height: (bottom - top) * scaleY };
        if (Math.abs(pulled.x + pulled.width - cornerX) < ALIGNED && others.some((o) => marksX(o).some((m) => Math.abs(m - cornerX) < ALIGNED))) {
          lines.push(guideFor('x', cornerX, pulled, others));
        }
        if (Math.abs(pulled.y + pulled.height - cornerY) < ALIGNED && others.some((o) => marksY(o).some((m) => Math.abs(m - cornerY) < ALIGNED))) {
          lines.push(guideFor('y', cornerY, pulled, others));
        }
      }
      setGuides(lines);
      setBlocks((list) => list.map((b) => sized.find((k) => k.key === b.key) ?? b));
      return;
    }

    if (d.mode === 'resize') {
      const block = onPage.find((b) => b.key === d.key);
      if (!block) return;
      let width = clamp(at.x - d.grabX - block.x, MIN_SIZE, 1 - block.x);
      const origin = d.origins[0];
      const follower = d.follower;
      // A date underneath is pushed down as the signature grows, so the signature stops where the date reaches the page's edge
      const room = follower && follower.y >= origin.y ? origin.height + (1 - follower.y - follower.height) : 1;
      let height = clamp(at.y - d.grabY - block.y, MIN_SIZE, Math.min(1 - block.y, room));
      if (snapping) {
        // The moving edge lines up with the others' edges and centres, or makes the block as wide or tall as one of them
        const right = nearestSnap([block.x + width], [...others.flatMap(marksX), ...others.map((o) => block.x + o.width), 0.5], reachX);
        if (right && right.at - block.x >= MIN_SIZE && right.at <= 1) width = right.at - block.x;
        const bottom = nearestSnap([block.y + height], [...others.flatMap(marksY), ...others.map((o) => block.y + o.height), 0.5], reachY);
        if (bottom && bottom.at - block.y >= MIN_SIZE && bottom.at - block.y <= room && bottom.at <= 1) height = bottom.at - block.y;
        const resized = { ...block, width, height };
        if (right && Math.abs(block.x + width - right.at) < ALIGNED) lines.push(guideFor('x', right.at, resized, others));
        if (bottom && Math.abs(block.y + height - bottom.at) < ALIGNED) lines.push(guideFor('y', bottom.at, resized, others));
      }
      setGuides(lines);
      // The date stays as far below the signature as it was, and keeps its place across it (centred stays centred)
      const followed = follower && {
        x: clamp(follower.x + (width - origin.width) / 2, 0, 1 - follower.width),
        y: clamp(follower.y + (height - origin.height), 0, 1 - follower.height),
      };
      setBlocks((list) =>
        list.map((b) => {
          if (b.key === d.key) return { ...b, width, height };
          return followed && b.key === follower.key ? { ...b, ...followed } : b;
        }),
      );
      return;
    }

    // Move the whole group by the same amount, stopping when its outer edge reaches the page edge
    // so the blocks keep their arrangement.
    const left = Math.min(...d.origins.map((o) => o.x));
    const right = Math.max(...d.origins.map((o) => o.x + o.width));
    const top = Math.min(...d.origins.map((o) => o.y));
    const bottom = Math.max(...d.origins.map((o) => o.y + o.height));
    let dx = clamp(at.x - d.startX, -left, 1 - right);
    let dy = clamp(at.y - d.startY, -top, 1 - bottom);
    if (snapping) {
      // The group snaps as one box: its outer edges and its centre
      const group = { x: left + dx, y: top + dy, width: right - left, height: bottom - top };
      const snapX = nearestSnap(marksX(group), [...others.flatMap(marksX), 0.5], reachX);
      if (snapX && left + dx + snapX.shift >= 0 && right + dx + snapX.shift <= 1) {
        dx += snapX.shift;
        lines.push(guideFor('x', snapX.at, { ...group, x: left + dx }, others));
      }
      const snapY = nearestSnap(marksY(group), [...others.flatMap(marksY), 0.5], reachY);
      if (snapY && top + dy + snapY.shift >= 0 && bottom + dy + snapY.shift <= 1) {
        dy += snapY.shift;
        lines.push(guideFor('y', snapY.at, { ...group, x: left + dx, y: top + dy }, others));
      }
    }
    setGuides(lines);
    setBlocks((list) =>
      list.map((b) => {
        const origin = d.origins.find((o) => o.key === b.key);
        return origin ? { ...b, x: origin.x + dx, y: origin.y + dy } : b;
      }),
    );
  };

  const endDrag = () => {
    drag.current = null;
    setGuides([]);
  };

  // The selection is exactly a signature and the date added with it
  const pairSelected = selectedOnPage.length > 1 && selectedOnPage.every((b) => b.pairId !== undefined && b.pairId === selectedOnPage[0].pairId);
  const pairBox = {
    left: Math.min(...selectedOnPage.map((b) => b.x)),
    top: Math.min(...selectedOnPage.map((b) => b.y)),
    right: Math.max(...selectedOnPage.map((b) => b.x + b.width)),
    bottom: Math.max(...selectedOnPage.map((b) => b.y + b.height)),
  };

  // The one field block selected, whose label and type can be changed in the panel on the left
  const editedField = selectedOnPage.length === 1 && selectedOnPage[0].content === 'FIELD' ? selectedOnPage[0] : undefined;
  const unnamedField = blocks.some((b) => b.content === 'FIELD' && (b.field?.label.trim() ?? '') === '');

  const signerIndex = (b: EditableBlock) => signers.findIndex((s) => signerKey(s) === signerKey(b));
  // A signer is placed once their signature has a block; a date is extra
  const missing = signers.filter((s) => !s.optional && !blocks.some((b) => b.content === 'SIGNATURE' && signerKey(b) === signerKey(s)));
  const toolButton =
    'flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-40';

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <p className="eyebrow">{text.eyebrow}</p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.018em]">{text.title}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{text.hint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col md:h-[min(72vh,760px)] md:flex-row">
        {/* Who signs */}
        <aside className="slim-scroll shrink-0 overflow-y-auto border-b border-line p-4 md:w-72 md:border-r md:border-b-0">
          <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">Signers</p>
          <ul className="mt-2.5 flex flex-col gap-2" aria-label="Signers">
            {signers.map((signer, i) => {
              const color = signerColor(i);
              const own = blocks.filter((b) => signerKey(b) === signerKey(signer));
              const count = own.filter((b) => b.content === 'SIGNATURE').length;
              const dates = own.filter((b) => b.content === 'DATE').length;
              const typed = own.filter((b) => b.content === 'FIELD').length;
              return (
                <li key={signerKey(signer)} className="rounded-lg border border-line bg-surface p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: color.border }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {signer.kind === 'STEP' && <span className="tnum text-muted">{signer.stepNo}. </span>}
                        {signer.label}
                      </p>
                      <p className="truncate text-[11.5px] text-muted" title={signer.detail}>
                        {signer.detail}
                      </p>
                    </div>
                  </div>
                  {signer.seal ? (
                    <>
                      <p className="tnum mt-2 text-[11.5px] text-muted">
                        {own.length === 0 ? 'Not used' : `${own.length} ${own.length === 1 ? 'place' : 'places'}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => add(signer, 'SEAL')}
                        disabled={!pdf}
                        aria-label={`Add a block for ${signer.label}`}
                        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-45"
                      >
                        <Stamp size={13} />
                        Seal
                      </button>
                    </>
                  ) : (
                  <>
                  <p className={cn('tnum mt-2 text-[11.5px]', count === 0 && !signer.optional ? 'font-medium text-[#A16207]' : 'text-muted')}>
                    {count === 0 ? (signer.optional ? 'Not used' : 'Signature not placed yet') : `${count} ${count === 1 ? 'signature' : 'signatures'}`}
                    {dates > 0 && ` · ${dates} ${dates === 1 ? 'date' : 'dates'}`}
                    {typed > 0 && ` · ${typed} ${typed === 1 ? 'field' : 'fields'}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => addPair(signer)}
                    disabled={!pdf}
                    aria-label={`Add a signature with its date for ${signer.label}`}
                    title="Adds the signature and the date under it, tied together so they are dragged as one"
                    className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:pointer-events-none disabled:opacity-45"
                  >
                    <CalendarCheck2 size={13} />
                    Signature + date
                  </button>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => add(signer)}
                      disabled={!pdf}
                      aria-label={`Add a block for ${signer.label}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <Plus size={13} strokeWidth={2.2} />
                      Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => add(signer, 'DATE')}
                      disabled={!pdf}
                      aria-label={`Add a date block for ${signer.label}`}
                      title="The day they sign is written here, for forms with a date box"
                      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <CalendarDays size={13} />
                      Date
                    </button>
                  </div>
                  {(fields || signer.fields) && (
                    <div className="mt-2 border-t border-line-soft pt-2">
                      <p className="text-[11px] text-muted">Something they type in</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => addField(signer, 'TEXT')}
                          disabled={!pdf}
                          aria-label={`Add a text field for ${signer.label}`}
                          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-45"
                        >
                          <TextCursorInput size={13} />
                          Text field
                        </button>
                        <button
                          type="button"
                          onClick={() => addField(signer, 'DATE')}
                          disabled={!pdf}
                          aria-label={`Add a date field for ${signer.label}`}
                          title="A day they choose, unlike “Date”, which is always the day they sign"
                          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-45"
                        >
                          <CalendarDays size={13} />
                          Date field
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </li>
              );
            })}
          </ul>
          {editedField?.field && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-2.5" aria-label="Selected field">
              <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">Selected field</p>
              <label htmlFor="field-label" className="mt-2 block text-[12px] font-medium text-ink-2">
                What to ask for
              </label>
              <Input
                id="field-label"
                size="small"
                value={editedField.field.label}
                maxLength={100}
                onChange={(e) => patchField(editedField.key, { label: e.target.value })}
                status={editedField.field.label.trim() === '' ? 'error' : undefined}
                placeholder="e.g. Lot number"
                className="mt-1"
              />
              <Segmented<FieldType>
                size="small"
                block
                className="mt-2"
                value={editedField.field.type}
                onChange={(type) => patchField(editedField.key, { type })}
                options={[
                  { value: 'TEXT', label: 'Text' },
                  { value: 'DATE', label: 'Date' },
                ]}
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
                <Switch size="small" checked={editedField.field.required} onChange={(required) => patchField(editedField.key, { required })} />
                Must be filled in
              </label>
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2 text-[11.5px] leading-relaxed text-muted">
            <p className="flex items-start gap-1.5">
              <MousePointerClick size={13} className="mt-0.5 shrink-0 text-faint" />
              “Signature + date” adds both at once, tied together: drag either and they move as one. The round
              corner of the outline sizes both; each one's own square corner sizes just that one. Add them separately when the date box
              is somewhere else on the form.
            </p>
            <p className="flex items-start gap-1.5">
              <CopyPlus size={13} className="mt-0.5 shrink-0 text-faint" />
              Signed on every page? Place the blocks once, then copy them to the other pages. Hold Shift and click to select several
              blocks; drag one to move them all.
            </p>
            <p className="flex items-start gap-1.5">
              <Magnet size={13} className="mt-0.5 shrink-0 text-faint" />
              Blocks snap into line with each other and with the middle of the page; a pink line shows what they lined up with. Hold Alt to
              place freely, or use the arrow keys to nudge.
            </p>
          </div>
        </aside>

        {/* The page */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#F4F4F5]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
            {files.length > 1 ? (
              <Select
                value={fileKey}
                onChange={(key) => {
                  setFileKey(key);
                  setPageNo(1);
                  setSelected([]);
                }}
                options={files.map((f) => ({ value: f.key, label: f.name }))}
                aria-label="File"
                className="w-64! max-w-full"
              />
            ) : (
              <p className="min-w-0 truncate text-[13px] font-medium text-ink">{file?.name}</p>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(pageNo - 1)}
                disabled={pageNo <= 1}
                aria-label="Previous page"
                className="rounded-md border border-line bg-surface p-1.5 text-ink-2 transition-colors hover:bg-[#FAFAFB] disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="tnum min-w-24 text-center text-[12.5px] text-ink-2">
                Page {pageCount === 0 ? '–' : pageNo} of {pageCount === 0 ? '–' : pageCount}
              </span>
              <button
                type="button"
                onClick={() => goToPage(pageNo + 1)}
                disabled={pageNo >= pageCount}
                aria-label="Next page"
                className="rounded-md border border-line bg-surface p-1.5 text-ink-2 transition-colors hover:bg-[#FAFAFB] disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* What can be done with the blocks on this page */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#FAFAFB] px-4 py-2" role="toolbar" aria-label="Blocks on this page">
            <span className="tnum mr-1 text-[12px] text-muted" aria-live="polite">
              {onPage.length === 0
                ? 'No blocks on this page'
                : selectedOnPage.length > 0
                  ? `${selectedOnPage.length} of ${onPage.length} selected`
                  : `${onPage.length} ${onPage.length === 1 ? 'block' : 'blocks'} on this page`}
            </span>
            <button type="button" onClick={selectAllOnPage} disabled={onPage.length === 0 || selectedOnPage.length === onPage.length} className={toolButton}>
              <SquareDashedMousePointer size={13} />
              Select all
            </button>
            <Tooltip title="Puts the same blocks on every other page of this file, in the same places. Pages can be adjusted afterwards.">
              <button type="button" onClick={copyToAllPages} disabled={copySource.length === 0 || pageCount < 2} className={toolButton}>
                <CopyPlus size={13} />
                Copy {selectedOnPage.length > 0 ? `${selectedOnPage.length} selected` : 'these'} to all pages
              </button>
            </Tooltip>
            <Tooltip title="Copies to the next page and opens it with the copies selected, ready to drag into place.">
              <button type="button" onClick={copyToNextPage} disabled={copySource.length === 0 || pageNo >= pageCount} className={toolButton}>
                <Copy size={13} />
                Copy to next page
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={removeSelected}
              disabled={selectedOnPage.length === 0}
              className={cn(toolButton, 'hover:border-danger-ring hover:bg-danger-soft hover:text-danger-strong')}
            >
              <Trash2 size={13} />
              Remove
            </button>
          </div>

          <div ref={stage} className="slim-scroll min-h-[55vh] flex-1 overflow-auto p-4 md:min-h-0" onPointerDown={() => setSelected([])}>
            {pdfError ? (
              <p className="mx-auto mt-16 max-w-sm text-center text-[13px] text-muted">{pdfError}</p>
            ) : (
              <div
                ref={page}
                className="relative mx-auto bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
                style={pageSize ? { width: pageSize.width, height: pageSize.height } : { width: '100%', height: 480 }}
              >
                <canvas ref={canvas} className="block size-full" aria-label={`Page ${pageNo} of ${file?.name ?? 'the document'}`} />
                {!pageSize && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Spin />
                  </div>
                )}

                {/* What the block being dragged has lined up with */}
                {guides.map((g) => (
                  <span
                    key={`${g.axis}:${g.at.toFixed(4)}`}
                    aria-hidden
                    className="pointer-events-none absolute z-20 bg-[#EC4899]"
                    style={
                      g.axis === 'x'
                        ? { left: `${g.at * 100}%`, top: `${g.from * 100}%`, height: `${(g.to - g.from) * 100}%`, width: 1, marginLeft: -0.5 }
                        : { top: `${g.at * 100}%`, left: `${g.from * 100}%`, width: `${(g.to - g.from) * 100}%`, height: 1, marginTop: -0.5 }
                    }
                  />
                ))}

                {pageSize &&
                  onPage.map((block) => {
                    const index = signerIndex(block);
                    const signer = signers[index];
                    const color = signerColor(Math.max(index, 0));
                    const active = selected.includes(block.key);
                    // Someone placing their own signature sees the signature itself, not a coloured box
                    const picture = block.content === 'SIGNATURE' ? signer?.imageUrl : undefined;
                    // With the real thing showing, the frame steps back: a thin dashed outline, stronger while selected
                    const real = signer?.imageUrl !== undefined;
                    // Remove and resize act on one block, so they show only when it is the only one selected
                    // (a signature with its date counts as one: each keeps its own handle and remove button)
                    const alone = active && (selectedOnPage.length === 1 || selectedOnPage.every((b) => b.pairId !== undefined && b.pairId === block.pairId));
                    return (
                      <div
                        key={block.key}
                        role="button"
                        tabIndex={0}
                        aria-label={
                          block.content === 'SEAL'
                            ? `${signer?.label ?? 'Company seal'} block`
                            : block.content === 'FIELD'
                            ? `${block.field?.label || 'Unnamed'} field block`
                            : `${signer?.label ?? 'Signature'} ${block.content === 'DATE' ? 'date block' : 'block'}`
                        }
                        aria-pressed={active}
                        onPointerDown={(e) => pressBlock(e, block)}
                        // Also receives the events of a resize in progress: they bubble up from the corner handle
                        onPointerMove={continueDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        className={cn(
                          'absolute cursor-move touch-none rounded-[3px] select-none',
                          real ? 'border border-dashed' : 'border-2',
                          block.content !== 'SIGNATURE' && 'border-dashed',
                          active && 'z-10',
                        )}
                        style={{
                          left: `${block.x * 100}%`,
                          top: `${block.y * 100}%`,
                          width: `${block.width * 100}%`,
                          height: `${block.height * 100}%`,
                          borderColor: real && !active ? 'rgb(31 74 143 / 0.35)' : color.border,
                          background: real ? (active ? 'rgb(31 74 143 / 0.06)' : 'transparent') : color.fill,
                          boxShadow: active && !real ? `0 0 0 3px ${color.fill}, 0 0 0 1px ${color.border}` : undefined,
                        }}
                      >
                        {block.content === 'SEAL' ? (
                          // The seal itself, fitted the way it is stamped
                          signer?.imageUrl ? (
                            <img src={signer.imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-contain" />
                          ) : (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold" style={{ color: color.text }}>
                              Seal
                            </span>
                          )
                        ) : block.content === 'FIELD' ? (
                          // The question it asks, so the boxes can be told apart on the page
                          <span
                            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 truncate px-1 text-[11px] font-medium italic"
                            style={{ color: color.text }}
                            title={`${block.field?.type === 'DATE' ? 'A date' : 'Text'} the supplier types${block.field?.required ? '' : ' (optional)'}`}
                          >
                            {block.field?.type === 'DATE' ? <CalendarDays size={11} className="shrink-0" /> : <TextCursorInput size={11} className="shrink-0" />}
                            <span className="truncate">{block.field?.label || 'Unnamed field'}</span>
                          </span>
                        ) : block.content === 'DATE' ? (
                          // Shown the way it will be written, so the box can be sized around it
                          <span
                            className="tnum pointer-events-none absolute inset-0 flex items-center justify-center truncate px-0.5 text-[11px] font-semibold"
                            style={{ color: real ? '#111827' : color.text }}
                            title={`${signer?.label ?? 'Signer'}: the date they sign`}
                          >
                            {DATE_EXAMPLE}
                          </span>
                        ) : picture ? (
                          // Fitted and centred the same way it is drawn on the document, so what is seen here is what is signed
                          <img src={picture} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-contain" />
                        ) : (
                          <span
                            className="pointer-events-none absolute top-0 left-0 max-w-full truncate rounded-br-[3px] px-1 text-[10.5px] leading-normal font-semibold text-white"
                            style={{ background: color.border }}
                          >
                            {signer?.kind === 'STEP' ? `${signer.stepNo}. ` : ''}
                            {signer?.label ?? 'Unknown signer'}
                          </span>
                        )}

                        {alone && (
                          <>
                            {/* For one block. A signature with its date is removed as one, from the toolbar or with Delete: two of
                                these buttons side by side would sit on top of each other's resize corner. */}
                            {selectedOnPage.length === 1 && (
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                setBlocks((list) => list.filter((b) => b.key !== block.key));
                                setSelected([]);
                              }}
                              aria-label={`Remove this ${signer?.label ?? 'signature'} ${block.content === 'DATE' ? 'date block' : 'block'}`}
                              className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm hover:text-danger-strong"
                            >
                              <X size={12} strokeWidth={2.4} />
                            </button>
                            )}
                            <span
                              role="slider"
                              tabIndex={-1}
                              aria-label="Resize"
                              aria-valuenow={Math.round(block.width * 100)}
                              onPointerDown={(e) => pressResizeHandle(e, block)}
                              className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize touch-none rounded-[3px] border-2 bg-surface"
                              style={{ borderColor: color.border }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}

                {/* A signature and its date picked up together: an outline around both, with one corner that sizes both */}
                {pageSize && pairSelected && (
                  <div
                    className="pointer-events-none absolute z-20 rounded-md border border-dashed border-brand-400"
                    style={{
                      left: `calc(${pairBox.left * 100}% - ${PAIR_MARGIN}px)`,
                      top: `calc(${pairBox.top * 100}% - ${PAIR_MARGIN}px)`,
                      width: `calc(${(pairBox.right - pairBox.left) * 100}% + ${PAIR_MARGIN * 2}px)`,
                      height: `calc(${(pairBox.bottom - pairBox.top) * 100}% + ${PAIR_MARGIN * 2}px)`,
                    }}
                  >
                    <span
                      role="slider"
                      tabIndex={-1}
                      aria-label="Resize both"
                      aria-valuenow={Math.round((pairBox.right - pairBox.left) * 100)}
                      title="Pull to size the signature and the date together"
                      onPointerDown={(e) => pressPairHandle(e, selectedOnPage)}
                      onPointerMove={continueDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className="pointer-events-auto absolute -right-2 -bottom-2 flex size-4.5 cursor-nwse-resize touch-none items-center justify-center rounded-full bg-brand-500 text-white shadow-sm ring-2 ring-white"
                    >
                      <Scaling size={10} strokeWidth={2.6} />
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className={cn('text-[12px]', missing.length > 0 ? 'text-[#A16207]' : 'text-muted')}>
          {missing.length > 0
            ? `No block yet for: ${missing.map((s) => s.label).join(', ')}`
            : `Every signer has a place. ${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'} in all.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (unnamedField) {
                message.warning('Give every field a label, so it is clear what to type there.');
                return;
              }
              onSave(blocks);
            }}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
          >
            {text.confirm}
          </button>
        </div>
      </div>
    </>
  );
}
