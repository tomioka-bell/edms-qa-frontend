import { Modal } from 'antd';
import { X } from 'lucide-react';
import RequestFileViewer from './RequestFileViewer';
import type { DocumentRequest, RequestRound } from '../../types/documentRequest';

/** What the preview needs to know about a request. */
export type PreviewableRequest = Pick<DocumentRequest, 'request_id' | 'request_no' | 'title' | 'files'>;

interface Props {
  /** Request whose files to show; null keeps the dialog closed. */
  request: PreviewableRequest | null;
  /** Show the files as they were in this round instead of as they are now. */
  round?: RequestRound;
  /** File to open on; otherwise the first one that can be shown. */
  fileId?: number;
  onClose: () => void;
}

/** Looks at a request's files without leaving the page. */
export default function RequestPreviewModal({ request, round, fileId, onClose }: Props) {
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
      {/* Unmounted with the dialog, so every opening starts on the file asked for */}
      {request && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <p className="eyebrow">{round ? `Preview · round ${round.round} as it was sent` : 'Preview'}</p>
              <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.018em]">{request.title}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                <span className="doc-code text-brand-600">{request.request_no}</span>
                <span>
                  · {(round ?? request).files.length} {(round ?? request).files.length === 1 ? 'file' : 'files'}
                </span>
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
          <RequestFileViewer key={round?.round ?? 'now'} request={request} round={round} fileId={fileId} className="h-[min(calc(100vh-150px),1100px)]" />
        </>
      )}
    </Modal>
  );
}
