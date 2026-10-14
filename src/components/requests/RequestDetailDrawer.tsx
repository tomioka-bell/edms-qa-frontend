import { useEffect, useState, type ReactNode } from 'react';
import { Drawer, Spin, Tooltip } from 'antd';
import { CircleCheck, Download, Eye, FileSignature, FileText, X } from 'lucide-react';
import FileChip from '../documentTemplates/FileChip';
import RequestHistory from './RequestHistory';
import RequestPreviewModal from './RequestPreviewModal';
import RequestRoute from './RequestRoute';
import RequestStatusTag, { DocTypeTag } from './RequestStatusTag';
import { ApiError } from '../../lib/api';
import { documentRequestFileUrl, getDocumentRequest } from '../../lib/documentRequests';
import { fileExtension, formatFileSize, revisionLabel } from '../../lib/documentTemplates';
import type { DocumentRequest } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';

interface Props {
  /** Request to show; null keeps the drawer closed. */
  requestId: number | null;
  onClose: () => void;
  /** Buttons for the bottom of the drawer, given the request once it has loaded. */
  footer?: (request: DocumentRequest) => ReactNode;
  /** Something the reader must see first, shown above the details (for example a warning). */
  notice?: (request: DocumentRequest) => ReactNode;
}

/** Everything about one request: its files, how far along its approval route it is, and what has happened to it. */
export default function RequestDetailDrawer({ requestId, onClose, footer, notice }: Props) {
  return (
    <Drawer
      open={requestId !== null}
      onClose={onClose}
      placement="right"
      size={520}
      closable={false}
      styles={{ body: { padding: 0 }, header: { display: 'none' }, wrapper: { maxWidth: '100vw' } }}
      destroyOnHidden
    >
      {/* Unmounted with the drawer, so the request is read again every time it opens */}
      {requestId !== null && <Detail requestId={requestId} onClose={onClose} footer={footer} notice={notice} />}
    </Drawer>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">{children}</p>;
}

function Detail({ requestId, onClose, footer, notice }: { requestId: number } & Pick<Props, 'onClose' | 'footer' | 'notice'>) {
  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The file being looked at in the preview; null when the preview is closed
  const [previewing, setPreviewing] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocumentRequest(requestId)
      .then((r) => {
        if (!cancelled) setRequest(r);
      })  
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'The request could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);


  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
    >
      <X size={18} />
    </button>
  );

  if (!request) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex justify-end px-5 py-4">{closeButton}</div>
        <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-muted">{error ?? <Spin />}</div>
      </div>
    );
  }

  const sent = request.round > 0;
  const extra = footer?.(request);
  const warning = notice?.(request);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="doc-code text-brand-600">{request.request_no}</span>
            <RequestStatusTag status={request.status} />
            <DocTypeTag type={request.doc_type} />
          </p>
          <h2 className="mt-1.5 text-[18px] leading-snug font-semibold tracking-[-0.018em]">{request.title}</h2>
          <p className="mt-1 text-[12px] text-muted">
            {request.requester_name || request.requester_code}
            {request.requester_department_code ? ` · ${request.requester_department_code}` : ''}
            {request.doc_code ? ` · from ${request.doc_code} ${revisionLabel(request.revision_no)}` : ''}
          </p>
        </div>
        {closeButton}
      </div>

      <div className="slim-scroll flex-1 overflow-y-auto">
        {warning && <div className="border-b border-line px-5 py-4">{warning}</div>}
        {request.description && (
          <section className="border-b border-line px-5 py-4">
            <SectionTitle>Note to approvers</SectionTitle>
            <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{request.description}</p>
          </section>
        )}

        <section className="border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SectionTitle>Files</SectionTitle>
              <span className="tnum rounded-full bg-[#F4F4F5] px-1.5 py-px text-[10.5px] font-semibold text-ink-2">{request.files.length}</span>
            </div>
            {request.files.length > 0 && (
              <button
                type="button"
                onClick={() => setPreviewing(request.files[0].file_id)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-brand-600 transition-colors hover:bg-brand-50"
              >
                <Eye size={13} />
                Preview all
              </button>
            )}
          </div>
          {request.files.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-line px-4 py-6 text-center">
              <FileText size={18} strokeWidth={1.75} className="text-faint" />
              <p className="mt-1.5 text-[12.5px] text-muted">No files yet</p>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {request.files.map((file) => {
                const ext = fileExtension(file.original_name);
                return (
                  <li
                    key={file.file_id}
                    className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pr-2 transition-[border-color,box-shadow] duration-150 hover:border-brand-200 hover:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_16px_-10px_rgb(31_74_143/0.25)]"
                  >
                    <FileChip extension={ext} />
                    {/* The whole name area opens the preview */}
                    <button type="button" onClick={() => setPreviewing(file.file_id)} className="min-w-0 flex-1 text-left" title={`Preview ${file.original_name}`}>
                      <span className="block truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-brand-700">{file.original_name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                        <span className="tnum">{formatFileSize(file.size_bytes)}</span>
                        <span className="text-faint" aria-hidden>
                          ·
                        </span>
                        {file.signed ? (
                          <span className="flex items-center gap-1 font-medium text-[#15803D]">
                            <CircleCheck size={12} strokeWidth={2.4} />
                            Signed{file.signed_at ? ` ${dayjs(file.signed_at).format('DD MMM YYYY')}` : ''}
                          </span>
                        ) : (
                          <span>{ext === 'pdf' ? 'Not signed yet' : 'Signatures go on PDF files only'}</span>
                        )}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 text-muted">
                      {file.signed && (
                        <Tooltip title="Open as it was sent, without signatures">
                          <a
                            href={documentRequestFileUrl(request.request_id, file.file_id, ext === 'pdf', true)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${file.original_name} without signatures`}
                            className="rounded-lg p-1.5 text-muted! transition-colors hover:bg-[#F4F4F5] hover:text-ink!"
                          >
                            <FileSignature size={15} />
                          </a>
                        </Tooltip>
                      )}
                      <Tooltip title="Download">
                        <a
                          href={documentRequestFileUrl(request.request_id, file.file_id)}
                          aria-label={`Download ${file.original_name}`}
                          className="rounded-lg p-1.5 text-muted! transition-colors hover:bg-[#F4F4F5] hover:text-ink!"
                        >
                          <Download size={15} />
                        </a>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="border-b border-line px-5 py-4">
          <SectionTitle>
            Approval route
            {request.approval_template_code && <span className="font-medium text-faint normal-case"> · {request.approval_template_code}</span>}
          </SectionTitle>
          <div className="mt-3">
            <RequestRoute steps={request.steps} live={sent} />
          </div>
        </section>

        <section className="px-5 py-4">
          <SectionTitle>History</SectionTitle>
          <div className="mt-3">
            <RequestHistory request={request} />
          </div>
        </section>
      </div>

      {extra && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-[#FAFAFB] px-5 py-3.5">{extra}</div>}

      <RequestPreviewModal request={previewing !== null ? request : null} fileId={previewing ?? undefined} onClose={() => setPreviewing(null)} />
    </div>
  );
}
