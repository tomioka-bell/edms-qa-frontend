import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App as AntApp, Popconfirm, Spin } from 'antd';
import { ArrowLeft, CalendarClock, Check, FileText, Pencil, PencilLine, ServerCrash, Signature, Undo2, Truck } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';
import DecisionModal, { type Decision } from '../../components/requests/DecisionModal';
import RequestFileViewer from '../../components/requests/RequestFileViewer';
import RequestHistory from '../../components/requests/RequestHistory';
import RequestRoute from '../../components/requests/RequestRoute';
import RoundPicker from '../../components/requests/RoundPicker';
import RequestStatusTag, { DocTypeTag } from '../../components/requests/RequestStatusTag';
import SignBlockEditor from '../../components/signBlocks/SignBlockEditor';
import type { EditableBlock } from '../../components/signBlocks/types';
import { ApiError } from '../../lib/api';
import { getMySignature } from '../../lib/signature';
import { documentRequestFileUrl, getDocumentRequest, recallDocumentRequest, sentBackBySupplier } from '../../lib/documentRequests';
import { fileExtension, revisionLabel } from '../../lib/documentTemplates';
import { useInboxStore } from '../../stores/inbox';
import { useCurrentUser } from '../../stores/session';
import type { DocumentRequest, DocumentRequestFile, SignaturePlacement } from '../../types/documentRequest';
import type { BlockContent } from '../../types/documentTemplate';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';

const pdfFilesOf = (request: DocumentRequest): DocumentRequestFile[] => request.files.filter((f) => fileExtension(f.original_name) === 'pdf');
const fileKey = (fileId: number) => `f:${fileId}`;

const PLACING_TEXT = {
  eyebrow: 'Approve',
  title: 'Place your signature',
  hint: 'Add your signature, drag it to where you sign, and pull its corner to size it. If the form has a box for the date, add a date there too.',
  confirm: 'Continue',
};

/** "Anan K. (Mock)" -> "AK" */
function initialsOf(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <h2 className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * One request on a page of its own: the document itself on the left, ready to read, and beside it
 * who asked, the approval route, the history and, when it is the reader's turn, the buttons to
 * approve or send back. The address carries the request id, so the page can be linked to.
 */
export default function ReviewDocumentPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const validId = Number.isInteger(requestId) && requestId > 0;
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { name: myName } = useCurrentUser();
  const refreshInbox = useInboxStore((s) => s.refresh);

  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [deciding, setDeciding] = useState<{ decision: Decision; placements?: SignaturePlacement[] } | null>(null);
  // Approving a normal document: the approver is choosing where their signature goes
  const [placing, setPlacing] = useState(false);
  // An earlier round whose documents are shown instead of the current ones; null = as they are now
  const [roundShown, setRoundShown] = useState<number | null>(null);
  // The reader's own signature picture, shown in the blocks they place; undefined until loaded or when they have none
  const [mySignatureUrl, setMySignatureUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getMySignature()
      .then((signature) => {
        if (!cancelled) setMySignatureUrl(signature?.image_url);
      })
      .catch(() => undefined); // the blocks then show as plain boxes
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    getDocumentRequest(requestId)
      .then((r) => {
        if (!cancelled) setRequest(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'The document could not be loaded.'));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, validId]);

  const failure = validId ? loadError : new ApiError(404, 'document request not found');
  if (failure) {
    return (
      <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
        <div className="panel">
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title={failure.status === 404 ? 'This document is not available' : 'The document could not be loaded'}
            description={failure.status === 404 ? 'It does not exist, or it has not been sent to you.' : failure.message}
            action={
              <Link to="/tasks" className="rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! hover:bg-brand-600!">
                Go to My Tasks
              </Link>
            }
          />
        </div>
      </div>
    );
  }
  if (!request) {
    return (
      <div className="grid h-80 place-items-center">
        <Spin />
      </div>
    );
  }

  const { viewer } = request;
  const requesterName = request.requester_name || request.requester_code;
  // Only worth offering once the request has been sent more than once
  const pastRound = roundShown !== null && roundShown !== request.round ? request.rounds.find((r) => r.round === roundShown) : undefined;
  // The request to fix that goes with what is on screen. Looking at an earlier version: what was
  // said about that version. Looking at the current one: what the round before it was sent back
  // for, which is what this version is supposed to have put right.
  const sendBackIn = (round: number) => request.history.find((h) => h.round === round && h.action === 'REJECT');
  const sentBack = pastRound ? sendBackIn(pastRound.round) : undefined;
  const askedBefore = !pastRound && request.round > 1 ? sendBackIn(request.round - 1) : undefined;
  const fixNote = sentBack ?? askedBefore;
  const back = viewer.is_requester && !viewer.can_decide ? { to: '/my-documents', label: 'My Documents' } : { to: '/tasks', label: 'My Tasks' };

  const recall = async () => {
    try {
      await recallDocumentRequest(request.request_id);
      void refreshInbox();
      message.success(`${request.request_no} is back with you. Change it, then send it again.`);
      navigate(`/documents/edit/${request.request_id}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The request could not be taken back.');
    }
  };

  /** A flow document knows where signatures go; on a normal one with PDFs the approver says where first. */
  const startApproval = () => {
    if (request.doc_type === 'NORMAL' && pdfFilesOf(request).length > 0) setPlacing(true);
    else setDeciding({ decision: 'approve' });
  };

  const finishPlacing = (blocks: EditableBlock[]) => {
    if (!blocks.some((b) => b.content === 'SIGNATURE')) {
      message.warning('Add a signature block and put it where you sign before continuing.');
      return;
    }
    setDeciding({
      decision: 'approve',
      placements: blocks.map((b) => ({ file_id: Number(b.fileKey.slice(2)), content: b.content as BlockContent, page_no: b.pageNo, x: b.x, y: b.y, width: b.width, height: b.height })),
    });
    setPlacing(false);
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 basis-full items-start gap-3 lg:flex-1 lg:basis-0">
          <Link
            to={back.to}
            aria-label={`Back to ${back.label}`}
            title={`Back to ${back.label}`}
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2! transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="doc-code text-brand-600">{request.request_no}</span>
              <RequestStatusTag status={request.status} />
              <DocTypeTag type={request.doc_type} />
              {request.round > 1 && <span className="tnum rounded bg-[#F4F4F5] px-1.5 py-px text-[11px] font-semibold text-ink-2">Round {request.round}</span>}
            </p>
            <h1 className="mt-1 truncate text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[24px]" title={request.title}>
              {request.title}
            </h1>

            {/* Who sent it, when, and which form it is on */}
            <dl className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
              <div className="flex items-center gap-2">
                <dt className="sr-only">From</dt>
                <dd className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700" aria-hidden>
                    {initialsOf(requesterName)}
                  </span>
                  <span className="font-medium text-ink-2">{requesterName}</span>
                  {request.requester_department_code && <span className="text-muted">· {request.requester_department_code}</span>}
                </dd>
              </div>
              {request.submitted_at && (
                <div className="flex items-center gap-1.5 text-muted">
                  <CalendarClock size={14} className="shrink-0 text-faint" />
                  <dt className="sr-only">Sent</dt>
                  <dd className="tnum" title={dayjs(request.submitted_at).format('DD MMM YYYY HH:mm')}>
                    Sent {dayjs(request.submitted_at).format('DD MMM YYYY')} · {dayjs(request.submitted_at).fromNow()}
                  </dd>
                </div>
              )}
              {request.doc_code && (
                <div className="flex items-center gap-1.5 text-muted">
                  <FileText size={14} className="shrink-0 text-faint" />
                  <dt className="sr-only">Document</dt>
                  <dd>
                    <span className="doc-code text-[11.5px] text-ink-2">{request.doc_code}</span> {revisionLabel(request.revision_no)}
                  </dd>
                </div>
              )}
              {request.valid_until && (
                <div className={cn('flex items-center gap-1.5', request.expired ? 'font-medium text-danger-strong' : 'text-muted')}>
                  <CalendarClock size={14} className={cn('shrink-0', !request.expired && 'text-faint')} />
                  <dt className="sr-only">Validity</dt>
                  <dd className="tnum">
                    {request.expired ? 'Expired' : 'Valid until'} {dayjs(request.valid_until).format('DD MMM YYYY')}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* How far along the route it is: one dot per step */}
        {request.round > 0 && request.steps.length > 0 && (
          <ol className="slim-scroll flex max-w-full shrink-0 items-start overflow-x-auto pb-1" aria-label="Approval progress">
            {request.supplier?.timing === 'BEFORE' && <SupplierDot request={request} />}
            {request.steps.map((step, i) => {
              const done = step.status === 'APPROVED';
              const returned = step.status === 'REJECTED';
              const now = step.status === 'ACTIVE' && request.status === 'IN_PROGRESS';
              return (
                <li key={step.step_no} className="flex items-start" aria-current={now ? 'step' : undefined}>
                  {(i > 0 || request.supplier?.timing === 'BEFORE') && (
                    <span className={cn('mt-3.5 h-0.5 w-8 sm:w-12', done || now || returned ? 'bg-brand-300' : 'bg-line')} aria-hidden />
                  )}
                  <span className="flex w-20 flex-col items-center gap-1 text-center">
                    <span
                      className={cn(
                        'tnum flex size-7 items-center justify-center rounded-full text-[12px] font-semibold',
                        done ? 'bg-ok text-white' : returned ? 'bg-danger text-white' : now ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-[#F4F4F5] text-muted',
                      )}
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : returned ? <Undo2 size={13} strokeWidth={2.6} /> : step.step_no}
                    </span>
                    <span className={cn('max-w-full truncate text-[11.5px]', now ? 'font-semibold text-ink' : 'font-medium text-muted')} title={step.step_name}>
                      {step.step_name}
                    </span>
                    <span className={cn('text-[10.5px] leading-none', done ? 'text-[#15803D]' : returned ? 'text-danger-strong' : now ? 'text-brand-600' : 'text-faint')}>
                      {done ? 'Passed' : returned ? 'Sent back' : now ? 'Deciding now' : 'Waiting'}
                    </span>
                  </span>
                </li>
              );
            })}
            {request.supplier?.timing === 'AFTER' && <SupplierDot request={request} />}
          </ol>
        )}
      </header>

      <div className="anim-rise mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* The document itself. Tall, and it stays in view while the details beside it scroll. */}
        <div className="panel flex flex-col overflow-hidden xl:sticky xl:top-[calc(var(--header-h)+16px)] xl:h-[calc(100svh-var(--header-h)-32px)]">
          {request.rounds.length > 1 && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-[#FAFAFB] px-4 py-2.5">
              <RoundPicker request={request} value={pastRound ? pastRound.round : request.round} onChange={setRoundShown} />
              {pastRound ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[#A16207]">
                    An earlier version, as sent on {dayjs(pastRound.sent_at).format('DD MMM YYYY HH:mm')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoundShown(null)}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                  >
                    Back to current
                  </button>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted">The version being approved now</span>
              )}

              {/* What the approver asked to be fixed, in their own words */}
              {fixNote && (
                // Just the words and who said them: a thin rule at the side is the only decoration
                <div className={cn('w-full border-l-2 pl-3', sentBack ? 'border-warn' : 'border-brand-300')}>
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink">{fixNote.comment || 'No reason was given.'}</p>
                  <p className="tnum mt-0.5 text-[11.5px] text-muted">
                    {fixNote.actor_name || fixNote.actor_code}
                    {sentBack ? ' sent this version back' : ` asked for this in round ${fixNote.round}`} · {dayjs(fixNote.created_at).format('DD MMM YYYY HH:mm')}
                  </p>
                </div>
              )}
            </div>
          )}
          <RequestFileViewer
            key={pastRound?.round ?? 'now'}
            request={request}
            round={pastRound}
            className="h-[88svh] xl:h-auto xl:min-h-0 xl:flex-1"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {viewer.can_decide && (
            <div className="panel overflow-hidden border-brand-200!">
              <div className="px-5 py-4">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Your decision</h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  Read the document, then approve it or send it back to be fixed.
                </p>
                {viewer.needs_signature && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<Signature size={16} />}
                    className="mt-3!"
                    title="Set up your signature before approving"
                    description={
                      <>
                        Approving signs the document, and you have no signature on file yet.{' '}
                        <Link to="/my-signature" className="font-semibold text-brand-600! underline">
                          Open My Signature
                        </Link>
                        , save one, then come back. You can still send the document back without it.
                      </>
                    }
                  />
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-line bg-[#FAFAFB] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setDeciding({ decision: 'reject' })}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger-ring bg-surface px-3.5 py-2 text-[13px] font-semibold text-danger-strong transition-colors hover:bg-danger-soft"
                >
                  <Undo2 size={14} />
                  Send back
                </button>
                <button
                  type="button"
                  disabled={viewer.needs_signature}
                  onClick={startApproval}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ok px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:pointer-events-none disabled:opacity-50"
                >
                  <Check size={15} strokeWidth={2.6} />
                  Approve
                </button>
              </div>
            </div>
          )}

          {viewer.is_requester && (request.status === 'IN_PROGRESS' || request.status === 'WITH_SUPPLIER') && (
            <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted">
                Your document is with {request.status === 'WITH_SUPPLIER' ? (request.supplier?.name ?? 'the supplier') : 'the approvers'}. Need to change it? Take it back, fix it, and
                send it again.
              </p>
              <Popconfirm
                title="Take this document back to change it?"
                description="The approvers stop seeing it, and signatures already given in this round no longer count. You then send it again."
                okText="Take it back"
                cancelText="Leave it"
                onConfirm={() => void recall()}
              >
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
                >
                  <PencilLine size={14} />
                  Take back to change
                </button>
              </Popconfirm>
            </div>
          )}

          {viewer.can_edit && (
            <div className="panel flex items-center justify-between gap-3 px-5 py-3.5">
              <p className="text-[12.5px] text-muted">
                {request.status !== 'RETURNED'
                  ? 'This document is still a draft.'
                  : sentBackBySupplier(request)
                    ? `${request.supplier?.name ?? 'The supplier'} sent this document back: “${request.supplier?.comment ?? ''}”`
                    : request.returned_step_no > 0
                      ? 'This document was sent back to you.'
                      : 'You took this document back to change it.'}
              </p>
              <Link
                to={`/documents/edit/${request.request_id}`}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
              >
                <Pencil size={14} />
                {request.status === 'RETURNED' ? 'Fix and send again' : 'Continue editing'}
              </Link>
            </div>
          )}

          <div className="panel overflow-hidden">
            {request.description && (
              <Section title="Note to approvers">
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{request.description}</p>
              </Section>
            )}
            <Section
              title={
                <>
                  Approval route
                  {request.approval_template_code && <span className="font-medium text-faint normal-case"> · {request.approval_template_code}</span>}
                </>
              }
            >
              <RequestRoute steps={request.steps} live={request.round > 0} />
            </Section>
            <Section title="History">
              <RequestHistory
                request={request}
                onViewRound={(round) => {
                  setRoundShown(round);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </Section>
          </div>
        </div>
      </div>

      <SignBlockEditor
        open={placing}
        // The copy that already carries earlier signatures, so nobody signs on top of someone else
        files={pdfFilesOf(request).map((f) => ({
          key: fileKey(f.file_id),
          name: f.original_name,
          source: { url: documentRequestFileUrl(request.request_id, f.file_id, true) },
        }))}
        signers={[{ kind: 'ISSUER', stepNo: 0, label: 'Your signature', detail: myName, imageUrl: mySignatureUrl }]}
        blocks={[]}
        text={PLACING_TEXT}
        onClose={() => setPlacing(false)}
        onSave={finishPlacing}
      />

      <DecisionModal
        decision={deciding?.decision ?? null}
        request={deciding ? request : null}
        placements={deciding?.placements}
        onClose={() => setDeciding(null)}
        onDone={(next, decision) => {
          setDeciding(null);
          message.success(
            decision === 'reject'
              ? `${next.request_no} was sent back to ${next.requester_name || 'the requester'}`
              : next.status === 'APPROVED'
                ? `${next.request_no} is fully approved.`
                : `${next.request_no} approved. It moves on to the next approver.`,
          );
          void refreshInbox();
          navigate('/tasks');
        }}
      />
    </div>
  );
}

/** The supplier's place on the progress line: before the first approval step or after the last. */
function SupplierDot({ request }: { request: DocumentRequest }) {
  const { supplier } = request;
  if (!supplier) return null;
  const done = supplier.state === 'DONE';
  const returned = sentBackBySupplier(request);
  const now = request.status === 'WITH_SUPPLIER';
  return (
    <li className="flex items-start" aria-current={now ? 'step' : undefined}>
      {supplier.timing === 'AFTER' && <span className={cn('mt-3.5 h-0.5 w-8 sm:w-12', done || now || returned ? 'bg-brand-300' : 'bg-line')} aria-hidden />}
      <span className="flex w-20 flex-col items-center gap-1 text-center">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full',
            done ? 'bg-ok text-white' : returned ? 'bg-danger text-white' : now ? 'bg-[#7C3AED] text-white ring-4 ring-[#EDE9FE]' : 'bg-[#F4F4F5] text-muted',
          )}
        >
          {done ? <Check size={14} strokeWidth={3} /> : returned ? <Undo2 size={13} strokeWidth={2.6} /> : <Truck size={13} />}
        </span>
        <span className={cn('max-w-full truncate text-[11.5px]', now ? 'font-semibold text-ink' : 'font-medium text-muted')} title={supplier.name}>
          {supplier.code}
        </span>
        <span className={cn('text-[10.5px] leading-none', done ? 'text-[#15803D]' : returned ? 'text-danger-strong' : now ? 'text-[#6D28D9]' : 'text-faint')}>
          {done ? 'Signed' : returned ? 'Sent back' : now ? 'With supplier' : 'Waiting'}
        </span>
      </span>
    </li>
  );
}
