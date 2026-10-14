import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { App as AntApp, Input, Popconfirm, Spin } from 'antd';
import { Ban, CircleCheckBig, Eye, Pencil, PencilLine, RotateCw, Search, ServerCrash, Undo2 } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import RequestFileViewer from '../../components/requests/RequestFileViewer';
import RequestPreviewModal from '../../components/requests/RequestPreviewModal';
import { DocTypeTag } from '../../components/requests/RequestStatusTag';
import { ApiError } from '../../lib/api';
import { cancelDocumentRequest, getDocumentRequest, listDocumentRequests, sentBackBySupplier, takenBackByRequester } from '../../lib/documentRequests';
import { revisionLabel } from '../../lib/documentTemplates';
import { useInboxStore } from '../../stores/inbox';
import type { DocumentRequest } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';

/** Who sent a request back, at which step, when and why. */
function sendBackOf(request: DocumentRequest) {
  // A supplier's send-back reads the same way: who, when and why. It belongs to no approval step.
  if (sentBackBySupplier(request) && request.supplier) {
    const { supplier } = request;
    return {
      step: undefined,
      approver: { name: `${supplier.signer_name || supplier.code} (${supplier.name})`, comment: supplier.comment, decided_at: supplier.done_at },
    };
  }
  const step = request.steps.find((s) => s.step_no === request.returned_step_no) ?? request.steps.find((s) => s.status === 'REJECTED');
  const approver = step?.approvers.find((a) => a.decision === 'REJECTED');
  return { step, approver };
}

/** "Anan K. (Mock)" -> "AK" */
function initialsOf(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

/** Why the document came back: who, at which step, when, and their words. The thing the requester needs most. */
function Reason({ request, clamp = false }: { request: DocumentRequest; clamp?: boolean }) {
  const { step, approver } = sendBackOf(request);
  const name = approver?.name ?? 'An approver';
  // Nobody sent it back: the requester took it back themselves, so there is no reason to show
  if (takenBackByRequester(request)) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-[#FAFAFB] px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-line" aria-hidden>
          <PencilLine size={14} />
        </span>
        <p className="text-[13px] text-ink-2">
          <span className="font-semibold">You took this document back to change it.</span> Send it again when it is ready.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-warn-soft px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[11px] font-semibold text-[#92400E] ring-1 ring-[#FDE68A]" aria-hidden>
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-[#854D0E]">
          <span className="font-semibold">{name}</span>
          <span>sent it back{step ? ` at step ${step.step_no} · ${step.step_name}` : ''}</span>
          {approver?.decided_at && (
            <span className="tnum" title={dayjs(approver.decided_at).format('DD MMM YYYY HH:mm')}>
              · {dayjs(approver.decided_at).fromNow()}
            </span>
          )}
        </p>
        <p className={cn('mt-1 text-[14px] leading-relaxed whitespace-pre-wrap text-ink', clamp && 'line-clamp-3')}>“{approver?.comment || 'No reason was given.'}”</p>
      </div>
    </div>
  );
}

/**
 * The signed-in person's own documents that an approver sent back.
 *
 * On a wide screen it reads like an inbox: the documents down the left, and the chosen one on the
 * right with the reason it came back, the version that was sent (signatures of that round included)
 * and the way to fix it and send it again. On a narrow screen each document is a card.
 */
export default function ReturnedDocumentsPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const setReturnedCount = useInboxStore((s) => s.setReturned);

  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // The chosen request loaded in full: the list leaves out the record of what each round was sent
  const [detail, setDetail] = useState<DocumentRequest | null>(null);
  // Narrow screens: the request whose sent version is open in a dialog
  const [shown, setShown] = useState<DocumentRequest | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDocumentRequests('mine')
      .then((list) => {
        if (cancelled) return;
        const returned = list.filter((r) => r.status === 'RETURNED');
        setRequests(returned);
        setReturnedCount(returned.length);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Your returned documents could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, setReturnedCount]);

  const needle = query.trim().toLowerCase();
  const filtered = requests.filter((r) => !needle || `${r.request_no} ${r.title} ${r.doc_code} ${sendBackOf(r).approver?.name ?? ''}`.toLowerCase().includes(needle));
  // Always something chosen when there is anything to choose
  const selected = filtered.find((r) => r.request_id === selectedId) ?? filtered[0] ?? null;
  const selectedRequestId = selected?.request_id ?? null;

  useEffect(() => {
    if (selectedRequestId === null) return;
    let cancelled = false;
    getDocumentRequest(selectedRequestId)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch(() => undefined); // the right side then keeps its spinner; the list and the buttons still work
    return () => {
      cancelled = true;
    };
  }, [selectedRequestId]);

  const full = detail && detail.request_id === selectedRequestId ? detail : null;

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const showSentVersion = async (request: DocumentRequest) => {
    setOpening(request.request_id);
    try {
      setShown(await getDocumentRequest(request.request_id));
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The document could not be opened.');
    } finally {
      setOpening(null);
    }
  };

  const cancel = async (request: DocumentRequest) => {
    try {
      await cancelDocumentRequest(request.request_id);
      const left = requests.filter((r) => r.request_id !== request.request_id);
      setRequests(left);
      setReturnedCount(left.length);
      message.success(`${request.request_no} was cancelled.`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The request could not be cancelled.');
    }
  };

  const outline =
    'flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-50';

  const cancelButton = (r: DocumentRequest) => (
    <Popconfirm
      title="Cancel this request?"
      description="It will be closed and cannot be sent again."
      okText="Cancel request"
      cancelText="Keep it"
      okButtonProps={{ danger: true }}
      onConfirm={() => void cancel(r)}
    >
      <button
        type="button"
        aria-label={`Cancel ${r.request_no}`}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
      >
        <Ban size={14} />
        Cancel request
      </button>
    </Popconfirm>
  );

  const fixButton = (r: DocumentRequest) => (
    <button
      type="button"
      onClick={() => navigate(`/documents/edit/${r.request_id}`)}
      aria-label={`Fix and send ${r.request_no} again`}
      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-600"
    >
      <Pencil size={14} />
      Fix and send again
    </button>
  );

  const meta = (r: DocumentRequest) => (
    <>
      {r.doc_code ? `${r.doc_code} ${revisionLabel(r.revision_no)} · ` : ''}
      {r.file_count} {r.file_count === 1 ? 'file' : 'files'}
      {r.submitted_at ? ` · sent ${dayjs(r.submitted_at).format('DD MMM YYYY')}` : ''}
    </>
  );

  const search = (
    <Input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      allowClear
      prefix={<Search size={15} className="text-faint" />}
      placeholder="Search number, title, or who sent it back"
      aria-label="Search returned documents"
    />
  );

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Documents"
        title="Returned Documents"
        description="Your documents that came back: sent back by an approver, or taken back by you. Fix them, then send them again."
        meta={
          !loading && !loadError && requests.length > 0 ? (
            <span className="tnum flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-warn-soft px-3 py-1.75 text-[13px] font-medium text-[#854D0E]">
              <Undo2 size={14} />
              {requests.length} waiting for you to fix
            </span>
          ) : undefined
        }
      />

      {loadError ? (
        <div className="panel mt-6">
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title="Your returned documents could not be loaded"
            description={loadError.message}
            action={
              <button type="button" onClick={reload} className={outline}>
                <RotateCw size={14} />
                Try again
              </button>
            }
          />
        </div>
      ) : loading ? (
        <div className="panel mt-6 grid h-56 place-items-center">
          <Spin />
        </div>
      ) : requests.length === 0 ? (
        <div className="anim-rise panel mt-6">
          <EmptyState
            icon={<CircleCheckBig size={19} strokeWidth={1.75} />}
            title="Nothing has been sent back"
            description="When an approver returns one of your documents, it shows up here with what needs fixing."
            action={
              <Link to="/my-documents" className="rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! hover:bg-brand-600!">
                Go to My Documents
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* ── Wide screens: the list on the left, the chosen document on the right ── */}
          <div className="anim-rise mt-6 hidden items-start gap-5 xl:grid xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="panel sticky top-[calc(var(--header-h)+16px)] flex max-h-[calc(100svh-var(--header-h)-32px)] flex-col overflow-hidden">
              <div className="border-b border-line p-3">{search}</div>
              {filtered.length === 0 ? (
                <EmptyState compact title="Nothing matches" description="Try a different search." />
              ) : (
                <ul className="slim-scroll flex-1 overflow-y-auto" aria-label="Returned documents">
                  {filtered.map((r) => {
                    const { approver } = sendBackOf(r);
                    const active = r.request_id === selectedRequestId;
                    return (
                      <li key={r.request_id} className="border-b border-line-soft last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.request_id)}
                          aria-current={active ? 'true' : undefined}
                          className={cn('relative block w-full px-4 py-3.5 text-left transition-colors', active ? 'bg-brand-50/70' : 'hover:bg-[#FAFAFB]')}
                        >
                          {active && <span className="absolute inset-y-2 left-0 w-0.75 rounded-r-full bg-brand-500" aria-hidden />}
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="doc-code text-[11.5px] text-brand-600">{r.request_no}</span>
                              <DocTypeTag type={r.doc_type} />
                            </span>
                            {approver?.decided_at && <span className="tnum shrink-0 text-[11.5px] text-muted">{dayjs(approver.decided_at).fromNow()}</span>}
                          </span>
                          <span className={cn('mt-1 block truncate text-[13.5px]', active ? 'font-semibold text-ink' : 'font-medium text-ink')}>{r.title}</span>
                          {takenBackByRequester(r) ? (
                            <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-snug text-muted">
                              <PencilLine size={12} className="shrink-0" />
                              You took it back to change it
                            </span>
                          ) : (
                            <span className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-[#854D0E]">
                              <Undo2 size={12} className="mt-0.5 shrink-0" />
                              <span className="line-clamp-2">
                                <span className="font-medium">{approver?.name ?? 'An approver'}:</span> {approver?.comment || 'No reason was given.'}
                              </span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selected && (
              <div className="panel flex h-[calc(100svh-var(--header-h)-32px)] min-h-140 flex-col overflow-hidden" aria-label={`Returned document ${selected.request_no}`}>
                <div className="shrink-0 px-5 pt-4 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="doc-code text-brand-600">{selected.request_no}</span>
                        <DocTypeTag type={selected.doc_type} />
                        <span className="tnum rounded bg-[#F4F4F5] px-1.5 py-px text-[11px] font-semibold text-ink-2">Round {selected.round}</span>
                      </p>
                      <h2 className="mt-1 truncate text-[19px] font-semibold tracking-[-0.018em] text-ink" title={selected.title}>
                        {selected.title}
                      </h2>
                      <p className="tnum mt-0.5 text-[12px] text-muted">{meta(selected)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {cancelButton(selected)}
                      {fixButton(selected)}
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <Reason request={selected} />
                  </div>
                </div>

                {/* What the approver was looking at when they sent it back, signatures of that round included */}
                <p className="shrink-0 border-t border-line bg-[#FAFAFB] px-5 py-2 text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">
                  {takenBackByRequester(selected) ? 'The version you sent' : 'The version that was sent back'}
                </p>
                {full ? (
                  <RequestFileViewer
                    key={full.request_id}
                    request={full}
                    round={full.rounds.find((round) => round.round === full.round)}
                    className="min-h-0 flex-1 border-t border-line"
                  />
                ) : (
                  <div className="grid flex-1 place-items-center border-t border-line bg-[#F4F4F5]">
                    <Spin />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Narrow screens: one card per document ── */}
          <div className="anim-rise mt-6 xl:hidden">
            {search}
            {filtered.length === 0 ? (
              <div className="panel mt-4">
                <EmptyState compact title="Nothing matches" description="Try a different search." />
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-4" aria-label="Returned documents">
                {filtered.map((r) => (
                  <li key={r.request_id} className="panel overflow-hidden">
                    <div className="px-4 pt-4">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="doc-code text-brand-600">{r.request_no}</span>
                        <DocTypeTag type={r.doc_type} />
                        {r.round > 1 && <span className="tnum rounded bg-[#F4F4F5] px-1.5 py-px text-[11px] font-semibold text-ink-2">Round {r.round}</span>}
                      </p>
                      <h2 className="mt-1 truncate text-[16px] font-semibold tracking-[-0.012em] text-ink" title={r.title}>
                        {r.title}
                      </h2>
                      <p className="tnum mt-0.5 text-[12px] text-muted">{meta(r)}</p>
                      <div className="mt-3">
                        <Reason request={r} clamp />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#FAFAFB] px-4 py-3">
                      {cancelButton(r)}
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" disabled={opening === r.request_id} onClick={() => void showSentVersion(r)} aria-label={`See what was sent for ${r.request_no}`} className={outline}>
                          <Eye size={14} />
                          {opening === r.request_id ? 'Opening…' : 'See what was sent'}
                        </button>
                        {fixButton(r)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <RequestPreviewModal request={shown} round={shown?.rounds.find((round) => round.round === shown.round)} onClose={() => setShown(null)} />
    </div>
  );
}
