import { useEffect, useState } from 'react';
import { Modal, Spin } from 'antd';
import { FileSignature, X } from 'lucide-react';
import PdfView from '../common/PdfView';
import FileChip from '../documentTemplates/FileChip';
import { ApiError } from '../../lib/api';
import { previewApprovedFile } from '../../lib/documentRequests';
import { fileExtension } from '../../lib/documentTemplates';
import type { DocumentRequest, SignaturePlacement } from '../../types/documentRequest';
import { cn } from '../../lib/cn';

interface Props {
  /** Request about to be approved; null keeps the dialog closed. */
  request: DocumentRequest | null;
  /** Where the approver chose to sign (normal documents); a flow document has its places already. */
  placements: SignaturePlacement[];
  onClose: () => void;
}

/**
 * Shows the document as it will look once the reader approves: earlier signatures plus their own,
 * drawn where it will go. It is an example only: nothing is signed until they confirm.
 */
export default function ApprovalPreviewModal({ request, placements, onClose }: Props) {
  return (
    <Modal
      open={request !== null}
      onCancel={onClose}
      width="min(1120px, calc(100vw - 32px))"
      centered
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {request && <Preview request={request} placements={placements} onClose={onClose} />}
    </Modal>
  );
}

function Preview({ request, placements, onClose }: { request: DocumentRequest; placements: SignaturePlacement[]; onClose: () => void }) {
  // Only PDFs can carry a drawn signature
  const files = request.files.filter((f) => fileExtension(f.original_name) === 'pdf');
  // Start on a file the reader signs on, if they chose places
  const [selectedId, setSelectedId] = useState<number | null>((files.find((f) => placements.some((p) => p.file_id === f.file_id)) ?? files[0])?.file_id ?? null);
  // The preview of the chosen file: an address for the viewer, or why there is none
  const [shown, setShown] = useState<{ fileId: number; url?: string; error?: string } | null>(null);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    let url: string | undefined;
    previewApprovedFile(request.request_id, selectedId, placements)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setShown({ fileId: selectedId, url });
      })
      .catch((err: unknown) => {
        if (!cancelled) setShown({ fileId: selectedId, error: err instanceof ApiError ? err.message : 'The preview could not be made.' });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [request.request_id, selectedId, placements]);

  const current = shown?.fileId === selectedId ? shown : null;

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Preview · not signed yet</p>
          <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.018em]">{request.title}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
            <FileSignature size={13} className="shrink-0 text-brand-500" />
            This is how the document will look with your signature on it. Nothing is signed until you approve.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex h-[min(calc(100vh-150px),1100px)] min-w-0 flex-col bg-[#F4F4F5]">
        {files.length > 1 && (
          <ul aria-label="Files" className="slim-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b border-line bg-surface px-3 py-2">
            {files.map((file) => {
              const active = file.file_id === selectedId;
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
                    <FileChip extension="pdf" size="sm" />
                    <span className={cn('truncate text-[12.5px] font-medium', active ? 'text-brand-700' : 'text-ink-2')}>{file.label || file.original_name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {files.length === 0 ? (
          <p className="m-auto max-w-sm px-6 text-center text-[13px] leading-relaxed text-muted">
            This document has no PDF file, so there is nothing to draw a signature on. Your approval is still recorded.
          </p>
        ) : current?.url ? (
          <PdfView url={current.url} title="Preview with your signature" className="flex-1" />
        ) : current?.error ? (
          <p className="m-auto max-w-sm px-6 text-center text-[13px] leading-relaxed text-muted">{current.error}</p>
        ) : (
          <div className="m-auto flex flex-col items-center gap-3 text-[12.5px] text-muted">
            <Spin />
            Putting your signature on the document…
          </div>
        )}
      </div>
    </>
  );
}
