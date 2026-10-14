import { useEffect, useState } from 'react';
import { Alert, Input, Modal, Spin } from 'antd';
import { Check, Eye, Undo2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { approveDocumentRequest, rejectDocumentRequest } from '../../lib/documentRequests';
import { getMySignature, type MySignature } from '../../lib/signature';
import type { DocumentRequest, SignaturePlacement } from '../../types/documentRequest';
import ApprovalPreviewModal from './ApprovalPreviewModal';
import RequestPreviewModal from './RequestPreviewModal';
import ValidUntilTag from './ValidUntilTag';

export type Decision = 'approve' | 'reject';

interface Props {
  /** What is being decided; null keeps the dialog closed. */
  decision: Decision | null;
  request: DocumentRequest | null;
  /** Approving a normal document: where the approver chose to put their signature */
  placements?: SignaturePlacement[];
  onClose: () => void;
  onDone: (request: DocumentRequest, decision: Decision) => void;
}

/** Confirms an approval (showing the signature that will be used) or asks why a document is sent back. */
// One shared empty list, so "no placements" is the same value on every render
const NO_PLACEMENTS: SignaturePlacement[] = [];

export default function DecisionModal({ decision, request, placements = NO_PLACEMENTS, onClose, onDone }: Props) {
  return (
    <Modal
      open={decision !== null && request !== null}
      onCancel={onClose}
      width={480}
      centered
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {decision && request && <Body decision={decision} request={request} placements={placements} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function Body({
  decision,
  request,
  placements,
  onClose,
  onDone,
}: {
  decision: Decision;
  request: DocumentRequest;
  placements: SignaturePlacement[];
  onClose: () => void;
  onDone: Props['onDone'];
}) {
  const approving = decision === 'approve';
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // undefined = still loading, null = none on file
  const [signature, setSignature] = useState<MySignature | null | undefined>(undefined);

  useEffect(() => {
    if (!approving) return;
    let cancelled = false;
    getMySignature()
      .then((s) => {
        if (!cancelled) setSignature(s);
      })
      .catch(() => {
        if (!cancelled) setSignature(null);
      });
    return () => {
      cancelled = true;
    };
  }, [approving]);

  const step = request.steps.find((s) => s.step_no === request.current_step_no);
  const signaturePlaces = placements.filter((p) => p.content === 'SIGNATURE').length;
  const datePlaces = placements.length - signaturePlaces;

  const confirm = async () => {
    const text = comment.trim();
    if (!approving && !text) {
      setError('Say what needs fixing, so the requester knows what to change.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const next = approving ? await approveDocumentRequest(request.request_id, text, placements) : await rejectDocumentRequest(request.request_id, text);
      onDone(next, decision);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <p className="eyebrow">
            {request.request_no}
            {step ? ` · Step ${step.step_no} · ${step.step_name}` : ''}
          </p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.018em]">{approving ? 'Approve this document?' : 'Send this document back?'}</h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[12.5px] text-muted" title={request.title}>
            <span className="truncate">{request.title}</span>
            <ValidUntilTag request={request} className="shrink-0" />
          </p>
          {request.files.length > 0 && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              // Without a signature on file there is nothing to show on the document
              disabled={approving && !signature}
              className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-50"
            >
              <Eye size={13} />
              {approving ? 'Preview with my signature' : 'Preview the document'}
            </button>
          )}
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

      <div className="px-6 py-5">
        {approving ? (
          <>
            <p className="text-[13px] text-ink-2">
              {placements.length > 0
                ? `Approving puts your signature on the document in the ${signaturePlaces === 1 ? 'place' : `${signaturePlaces} places`} you chose${datePlaces > 0 ? ', with today’s date' : ''}:`
                : request.doc_type === 'FLOW'
                  ? 'Approving puts your signature in the box marked for your step:'
                  : 'Approving signs the document with your signature:'}
            </p>
            <div className="mt-2.5 flex h-28 items-center justify-center rounded-xl border border-line bg-[#FAFAFB] px-4">
              {signature === undefined ? (
                <Spin />
              ) : signature ? (
                <img src={signature.image_url} alt="Your signature" className="max-h-20 max-w-full object-contain" />
              ) : (
                <span className="text-[12.5px] text-[#A16207]">You have no signature on file yet.</span>
              )}
            </div>
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-2">
            The document goes straight back to {request.requester_name || 'the requester'} to be fixed. The other approvers are not asked.
          </p>
        )}

        <label htmlFor="decision-comment" className="mt-4 block text-[13px] font-medium text-ink-2">
          {approving ? (
            <>
              Comment <span className="font-normal text-muted">(optional)</span>
            </>
          ) : (
            'What needs fixing?'
          )}
        </label>
        <Input.TextArea
          id="decision-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          showCount
          autoFocus={!approving}
          status={error && !approving && !comment.trim() ? 'error' : undefined}
          placeholder={approving ? 'Anything to add' : 'e.g. The lot number is missing on page 1'}
          className="mt-1.5"
        />

        {error && <Alert type="error" showIcon className="mt-5!" title={error} />}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink disabled:opacity-60"
        >
          Not now
        </button>
        {approving ? (
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={sending || !signature}
            className="flex items-center gap-1.5 rounded-lg bg-ok px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:pointer-events-none disabled:opacity-50"
          >
            <Check size={15} strokeWidth={2.6} />
            {sending ? 'Approving…' : 'Approve and sign'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-danger-strong disabled:opacity-60"
          >
            <Undo2 size={15} />
            {sending ? 'Sending back…' : 'Send back'}
          </button>
        )}
      </div>

      {/* Approving: the document with the reader's own signature drawn in. Sending back: the document as it is. */}
      <ApprovalPreviewModal request={previewOpen && approving ? request : null} placements={placements} onClose={() => setPreviewOpen(false)} />
      <RequestPreviewModal request={previewOpen && !approving ? request : null} onClose={() => setPreviewOpen(false)} />
    </>
  );
}
