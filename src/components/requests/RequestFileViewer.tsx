import { useState } from 'react';
import { Segmented } from 'antd';
import { Download, ExternalLink, FileX2 } from 'lucide-react';
import PdfView from '../common/PdfView';
import FileChip from '../documentTemplates/FileChip';
import { documentRequestFileUrl, documentRequestRoundFileUrl } from '../../lib/documentRequests';
import { fileExtension, formatFileSize } from '../../lib/documentTemplates';
import type { DocumentRequest, RequestRound } from '../../types/documentRequest';
import { cn } from '../../lib/cn';

/** What the viewer needs to know about a request. */
export type ViewableRequest = Pick<DocumentRequest, 'request_id' | 'files'>;

interface Props {
  request: ViewableRequest;
  /**
   * Show the files as they were in this round instead of as they are now. Give the viewer a `key`
   * that changes with the round, so it starts again on that round's first file.
   */
  round?: RequestRound;
  /** File to open on; otherwise the first one that can be shown. */
  fileId?: number;
  /** Sizing of the whole viewer; it fills whatever height it is given. */
  className?: string;
}

// Browsers display PDFs themselves; Word and Excel files have to be downloaded and opened in Office.
const isPdf = (name: string) => fileExtension(name) === 'pdf';

/**
 * Shows a request's files in place: a tab per file when there are several, then the chosen file.
 * A file that has been signed opens as the signed copy, with a switch to the file as it was sent.
 */
export default function RequestFileViewer({ request, round, fileId, className }: Props) {
  // A round's files are addressed by their own ids and their own link; everything else is the same
  const files = round ? round.files.map((f) => ({ ...f, file_id: f.round_file_id })) : request.files;
  const fileUrl = (id: number, selectedFileId: number, inline = false, original = false) =>
    round ? documentRequestRoundFileUrl(id, selectedFileId, inline, original) : documentRequestFileUrl(id, selectedFileId, inline, original);
  const [selectedId, setSelectedId] = useState<number | null>(
    (files.find((f) => f.file_id === fileId) ?? files.find((f) => isPdf(f.original_name)) ?? files[0])?.file_id ?? null,
  );
  // Which copy of a signed file to show
  const [original, setOriginal] = useState(false);
  // The place in the toolbar where the PDF viewer puts its zoom control
  const [zoomSlot, setZoomSlot] = useState<HTMLDivElement | null>(null);
  // A file can disappear while the viewer is open (replaced or removed in the editor): fall back to the first
  const selected = files.find((f) => f.file_id === selectedId) ?? files[0] ?? null;
  const id = request.request_id;
  const showOriginal = original && (selected?.signed ?? false);

  if (!selected) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-[#F4F4F5] px-6 py-16 text-center', className)}>
        <span className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-faint">
          <FileX2 size={19} strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-ink">No files to show</p>
        <p className="mt-1.5 max-w-sm text-[13px] text-muted">This document has no files yet.</p>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col bg-[#F4F4F5]', className)}>
      {files.length > 1 && (
        <ul aria-label="Files" className="slim-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b border-line bg-surface px-3 py-2">
          {files.map((file) => {
            const active = file.file_id === selected.file_id;
            return (
              <li key={file.file_id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(file.file_id)}
                  aria-current={active ? 'true' : undefined}
                  title={file.original_name}
                  className={cn(
                    'flex max-w-60 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                    active ? 'border-brand-200 bg-brand-50' : 'border-transparent hover:bg-[#F4F4F5]',
                  )}
                >
                  <FileChip extension={fileExtension(file.original_name)} size="sm" />
                  <span className="min-w-0">
                    <span className={cn('block truncate text-[12.5px] font-medium', active ? 'text-brand-700' : 'text-ink-2')}>
                      {file.label || file.original_name}
                    </span>
                    <span className="tnum block truncate text-[11px] text-faint">
                      {file.signed ? 'Signed · ' : ''}
                      {formatFileSize(file.size_bytes)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <p className="min-w-24 flex-1 truncate text-[13px] font-medium text-ink" title={selected.original_name}>
          {selected.original_name}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* Zoom sits here, not over the document, so it is in reach however tall the viewer is */}
          {isPdf(selected.original_name) && <div ref={setZoomSlot} />}
          {selected.signed && (
            <Segmented
              size="small"
              value={showOriginal ? 'original' : 'signed'}
              onChange={(value) => setOriginal(value === 'original')}
              aria-label="Which copy to show"
              options={[
                { value: 'signed', label: 'With signatures' },
                { value: 'original', label: 'As sent' },
              ]}
            />
          )}
          {isPdf(selected.original_name) && (
            <a
              href={fileUrl(id, selected.file_id, true, showOriginal)}
              target="_blank"
              rel="noreferrer"
              // Icons only: with the zoom control in this row, words would push it onto a second line
              aria-label="Open in new tab"
              title="Open in new tab"
              className="flex size-8.5 items-center justify-center rounded-lg border border-line bg-surface text-ink-2! transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <a
            href={fileUrl(id, selected.file_id, false, showOriginal)}
            aria-label="Download"
            title="Download"
            className="flex size-8.5 items-center justify-center rounded-lg bg-brand-500! text-white! transition-colors hover:bg-brand-600!"
          >
            <Download size={15} />
          </a>
        </div>
      </div>

      {isPdf(selected.original_name) ? (
        // The address changes with the file, the copy and each new signature, which is what makes the viewer reload
        <PdfView
          url={`${fileUrl(id, selected.file_id, true, showOriginal)}${selected.signed_at ? `&v=${encodeURIComponent(selected.signed_at)}` : ''}`}
          title={selected.original_name}
          className="flex-1"
          controlsIn={zoomSlot}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <FileChip extension={fileExtension(selected.original_name)} />
          <p className="mt-4 text-[15px] font-semibold text-ink">This file can't be shown here</p>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
            Word and Excel files open in Microsoft Office. Download the file to view it; only PDF files can be shown in the browser.
          </p>
          <a
            href={fileUrl(id, selected.file_id)}
            className="mt-5 flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
          >
            <Download size={14} />
            Download {selected.original_name}
          </a>
        </div>
      )}
    </div>
  );
}
