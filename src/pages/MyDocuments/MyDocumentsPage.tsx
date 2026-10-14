import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { App as AntApp, Input, Popconfirm, Segmented, Spin, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Ban, FileSearch, History, FileText, Pencil, PencilLine, Plus, RotateCw, Search, ServerCrash, Trash2 } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import RequestDetailDrawer from '../../components/requests/RequestDetailDrawer';
import RequestPreviewModal from '../../components/requests/RequestPreviewModal';
import RequestStatusTag, { DocTypeTag } from '../../components/requests/RequestStatusTag';
import { ApiError } from '../../lib/api';
import { REQUEST_STATUS_LABEL, sentBackBySupplier, cancelDocumentRequest, deleteDocumentRequest, listDocumentRequests, recallDocumentRequest } from '../../lib/documentRequests';
import { revisionLabel } from '../../lib/documentTemplates';
import { useInboxStore } from '../../stores/inbox';
import type { DocumentRequest, RequestStatus } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { EXPIRING_SOON_DAYS, daysUntilExpiry, describeDue } from '../../lib/deadlines';

const STATUSES: RequestStatus[] = ['DRAFT', 'IN_PROGRESS', 'WITH_SUPPLIER', 'RETURNED', 'APPROVED', 'CANCELLED'];

function Summary({ request }: { request: DocumentRequest }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2">
        <span className="doc-code text-brand-600">{request.request_no}</span>
        <DocTypeTag type={request.doc_type} />
      </p>
      <p className="mt-1 truncate text-[13.5px] font-semibold text-ink" title={request.title}>
        {request.title}
      </p>
      <p className="tnum mt-0.5 truncate text-[12px] text-muted">
        {request.doc_code ? `${request.doc_code} ${revisionLabel(request.revision_no)} · ` : ''}
        {request.file_count} {request.file_count === 1 ? 'file' : 'files'}
      </p>
    </div>
  );
}

/** Where the request stands, in words, with a row of dots: one per step. */
function Progress({ request }: { request: DocumentRequest }) {
  const current = request.steps.find((s) => s.step_no === request.current_step_no);
  const waitingFor = current?.approvers.filter((a) => a.decision === 'PENDING').map((a) => a.name) ?? [];
  const rejected = request.steps.find((s) => s.status === 'REJECTED')?.approvers.find((a) => a.decision === 'REJECTED');

  let line: string;
  let detail = '';
  switch (request.status) {
    case 'DRAFT':
      line = 'Not sent yet';
      detail = request.step_count === 0 ? 'No approvers set' : `${request.step_count} ${request.step_count === 1 ? 'step' : 'steps'} planned`;
      break;
    case 'IN_PROGRESS':
      line = `Step ${request.current_step_no} of ${request.step_count} · ${request.current_step_name}`;
      detail = waitingFor.length > 0 ? `Waiting for ${waitingFor.join(current?.approval_rule === 'ALL' ? ' and ' : ' or ')}` : '';
      if (current?.due_at) detail += `${detail ? ' · ' : ''}${describeDue(current.due_at).text.toLowerCase()}`;
      break;
    case 'WITH_SUPPLIER':
      line = `With ${request.supplier?.name ?? 'the supplier'}`;
      detail = request.supplier?.timing === 'BEFORE' ? 'Approval starts once they have filled it in and signed' : 'Every step has passed; waiting for them to fill it in and sign';
      break;
    case 'RETURNED':
      if (sentBackBySupplier(request)) {
        line = `Sent back by ${request.supplier?.name ?? 'the supplier'}`;
        detail = request.supplier?.comment ? `${request.supplier.signer_name}: “${request.supplier.comment}”` : '';
        break;
      }
      line = request.returned_step_no > 0 ? `Sent back at step ${request.returned_step_no}` : 'Taken back to change';
      detail = request.returned_step_no > 0 ? (rejected ? `${rejected.name}: “${rejected.comment}”` : '') : 'Waiting for you to send it again';
      break;
    case 'APPROVED':
      line = `All ${request.step_count} ${request.step_count === 1 ? 'step' : 'steps'} passed`;
      detail = request.completed_at ? `Approved ${dayjs(request.completed_at).format('DD MMM YYYY')}` : '';
      break;
    default:
      line = 'Closed';
      detail = request.completed_at ? `Cancelled ${dayjs(request.completed_at).format('DD MMM YYYY')}` : '';
  }

  const live = request.round > 0;
  return (
    <div className="min-w-0">
      {request.steps.length > 0 && (
        <p className="mb-1.5 flex items-center gap-1" aria-hidden>
          {request.steps.map((s) => (
            <span
              key={s.step_no}
              className={cn(
                'h-1.5 w-6 rounded-full',
                !live || s.status === 'WAITING' ? 'bg-[#E4E4E7]' : s.status === 'APPROVED' ? 'bg-ok' : s.status === 'REJECTED' ? 'bg-danger' : 'bg-brand-500',
              )}
            />
          ))}
        </p>
      )}
      <p className="truncate text-[13px] font-medium text-ink-2">{line}</p>
      {detail && (
        <p className="mt-0.5 truncate text-[12px] text-muted" title={detail}>
          {detail}
        </p>
      )}
    </div>
  );
}

/** The requests the signed-in person has made: drafts, those in approval, and those finished. */
export default function MyDocumentsPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<DocumentRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDocumentRequests('mine')
      .then((list) => {
        if (cancelled) return;
        setRequests(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Your documents could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const cancel = async (request: DocumentRequest) => {
    try {
      const next = await cancelDocumentRequest(request.request_id);
      setRequests((list) => list.map((r) => (r.request_id === next.request_id ? next : r)));
      message.success(`${request.request_no} was cancelled.`);
      void useInboxStore.getState().refresh(); // it may have been one of the returned documents
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The request could not be cancelled.');
    }
  };

  /** Takes a request that is waiting for approval back and opens it for editing. */
  const recall = async (request: DocumentRequest) => {
    try {
      await recallDocumentRequest(request.request_id);
      void useInboxStore.getState().refresh();
      message.success(`${request.request_no} is back with you. Change it, then send it again.`);
      navigate(`/documents/edit/${request.request_id}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The request could not be taken back.');
    }
  };

  const remove = async (request: DocumentRequest) => {
    try {
      await deleteDocumentRequest(request.request_id);
      setRequests((list) => list.filter((r) => r.request_id !== request.request_id));
      message.success('Draft deleted.');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The draft could not be deleted.');
    }
  };

  const needle = query.trim().toLowerCase();
  const filtered = requests.filter(
    (r) =>
      (status === 'ALL' || r.status === status) &&
      (!needle || `${r.request_no} ${r.title} ${r.doc_code}`.toLowerCase().includes(needle)),
  );
  const countOf = (s: RequestStatus) => requests.filter((r) => r.status === s).length;

  const iconButton = 'rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink';

  const rowActions = (r: DocumentRequest) => (
    <div className="flex items-center justify-end gap-0.5">
      {r.file_count > 0 && (
        <Tooltip title="Preview the document">
          <button type="button" onClick={() => setPreviewing(r)} aria-label={`Preview ${r.request_no}`} className={iconButton}>
            <FileSearch size={16} />
          </button>
        </Tooltip>
      )}
      <Tooltip title="Progress and history">
        <button type="button" onClick={() => setViewing(r.request_id)} aria-label={`View ${r.request_no}`} className={iconButton}>
          <History size={16} />
        </button>
      </Tooltip>
      {r.viewer.can_edit && (
        <Tooltip title={r.status === 'RETURNED' ? 'Fix and send again' : 'Continue editing'}>
          <button type="button" onClick={() => navigate(`/documents/edit/${r.request_id}`)} aria-label={`Edit ${r.request_no}`} className={iconButton}>
            <Pencil size={16} />
          </button>
        </Tooltip>
      )}
      {r.status === 'DRAFT' && r.round === 0 && (
        <Popconfirm title="Delete this draft?" okText="Delete draft" cancelText="Keep it" okButtonProps={{ danger: true }} onConfirm={() => void remove(r)}>
          <button type="button" aria-label={`Delete ${r.request_no}`} className={cn(iconButton, 'hover:bg-danger-soft hover:text-danger-strong')}>
            <Trash2 size={16} />
          </button>
        </Popconfirm>
      )}
      {(r.status === 'IN_PROGRESS' || r.status === 'WITH_SUPPLIER') && r.viewer.is_requester && (
        <Popconfirm
          title="Take this document back to change it?"
          description="The approvers stop seeing it, and signatures already given in this round no longer count. You then send it again."
          okText="Take it back"
          cancelText="Leave it"
          onConfirm={() => void recall(r)}
        >
          <button type="button" aria-label={`Take back ${r.request_no}`} title="Take back to change" className={iconButton}>
            <PencilLine size={16} />
          </button>
        </Popconfirm>
      )}
      {(r.status === 'IN_PROGRESS' || r.status === 'WITH_SUPPLIER' || r.status === 'RETURNED') && (
        <Popconfirm
          title="Cancel this request?"
          description="It will be closed and cannot be sent again."
          okText="Cancel request"
          cancelText="Keep it"
          okButtonProps={{ danger: true }}
          onConfirm={() => void cancel(r)}
        >
          <button type="button" aria-label={`Cancel ${r.request_no}`} className={cn(iconButton, 'hover:bg-danger-soft hover:text-danger-strong')}>
            <Ban size={16} />
          </button>
        </Popconfirm>
      )}
    </div>
  );

  /** The document's dates as one small table: when it was sent (or last edited), and the last day it is valid. */
  const lastActivity = (r: DocumentRequest) => {
    const days = r.valid_until ? daysUntilExpiry(r.valid_until) : null;
    const over = days !== null && days < 0;
    const soon = days !== null && !over && days <= EXPIRING_SOON_DAYS;
    return (
      // The label column has one width in every row, so the dates line up down the table
      <dl className="grid grid-cols-[4.25rem_1fr] items-baseline gap-x-2 gap-y-1 text-[12.5px]">
        <dt className="whitespace-nowrap text-faint">{r.submitted_at ? 'Sent' : 'Edited'}</dt>
        <dd className="tnum flex items-center gap-1.5 whitespace-nowrap text-ink-2">
          {dayjs(r.submitted_at ?? r.updated_at).format('DD MMM YYYY')}
          {r.submitted_at && r.round > 1 && (
            <span className="rounded bg-[#F4F4F5] px-1 text-[10.5px] font-medium text-muted" title={`Sent ${r.round} times: this is round ${r.round}`}>
              R{r.round}
            </span>
          )}
        </dd>
        {r.valid_until && days !== null && (
          <>
            <dt className="whitespace-nowrap text-faint">{over ? 'Expired' : 'Valid until'}</dt>
            <dd
              className={cn('tnum flex items-center gap-1.5 whitespace-nowrap', over ? 'font-medium text-danger-strong' : soon ? 'font-medium text-[#A16207]' : 'text-ink-2')}
              title={over ? 'Past the last day it was valid' : days === 0 ? 'Today is the last day it is valid' : `${days} ${days === 1 ? 'day' : 'days'} left`}
            >
              {dayjs(r.valid_until).format('DD MMM YYYY')}
              {/* A dot, not a badge: the colour says how near the end is without shouting over the row */}
              {(over || soon) && <span className={cn('size-1.5 shrink-0 rounded-full', over ? 'bg-danger' : 'bg-warn')} aria-hidden />}
            </dd>
          </>
        )}
      </dl>
    );
  };

  const columns: ColumnsType<DocumentRequest> = [
    { title: 'Document', key: 'document', width: 320, render: (_, r) => <Summary request={r} /> },
    { title: 'Status', key: 'status', width: 130, render: (_, r) => <RequestStatusTag status={r.status} /> },
    { title: 'Progress', key: 'progress', render: (_, r) => <Progress request={r} /> },
    { title: 'Date', key: 'date', width: 190, render: (_, r) => lastActivity(r) },
    { title: '', key: 'actions', width: 176, align: 'right', render: (_, r) => rowActions(r) },
  ];

  const newButton = (
    <Link
      to="/documents/new"
      className="flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2.25 text-[13.5px] font-semibold text-white! transition-colors duration-150 hover:bg-brand-600!"
    >
      <Plus size={16} strokeWidth={2.4} />
      Create Document
    </Link>
  );

  const emptyState =
    requests.length === 0 ? (
      <EmptyState
        icon={<FileText size={19} strokeWidth={1.75} />}
        title="You have not created a document yet"
        description="Create one to send it for approval. Drafts and everything you have sent show up here."
        action={newButton}
      />
    ) : (
      <EmptyState compact title="Nothing matches" description="Try another status or a different search." />
    );

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Documents"
        title="My Documents"
        description="Documents you have created: drafts, those waiting for approval, and those that are done."
        actions={!loadError && newButton}
      />

      <div className="anim-rise panel mt-6 overflow-hidden">
        {loadError ? (
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title="Your documents could not be loaded"
            description={loadError.message}
            action={
              <button
                type="button"
                onClick={reload}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                <RotateCw size={14} />
                Try again
              </button>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <div className="max-w-full overflow-x-auto">
                <Segmented
                  value={status}
                  onChange={(value) => setStatus(value as RequestStatus | 'ALL')}
                  aria-label="Filter by status"
                  options={[
                    { value: 'ALL', label: `All ${requests.length}` },
                    ...STATUSES.map((s) => ({ value: s, label: `${REQUEST_STATUS_LABEL[s]} ${countOf(s)}` })),
                  ]}
                />
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                allowClear
                prefix={<Search size={15} className="text-faint" />}
                placeholder="Search by number, title, or document code"
                aria-label="Search my documents"
                className="w-full! sm:ml-auto sm:w-72!"
              />
            </div>

            {/* Narrow windows: one card per request. The table needs the room it gets from xl up. */}
            <div className="xl:hidden">
              {loading ? (
                <div className="grid h-40 place-items-center">
                  <Spin />
                </div>
              ) : filtered.length === 0 ? (
                emptyState
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((r) => (
                    <li key={r.request_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <Summary request={r} />
                        <div className="-mt-1 -mr-1.5 shrink-0">{rowActions(r)}</div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <RequestStatusTag status={r.status} />
                        <span className="tnum text-[12px] text-muted">{dayjs(r.submitted_at ?? r.updated_at).format('DD MMM YYYY')}</span>
                      </div>
                      <div className="mt-3">
                        <Progress request={r} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden xl:block">
              <Table<DocumentRequest>
                rowKey="request_id"
                tableLayout="fixed"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                pagination={filtered.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                scroll={{ x: 900 }}
                locale={{ emptyText: loading ? <div className="h-40" /> : emptyState }}
              />
            </div>
          </>
        )}
      </div>

      <RequestPreviewModal request={previewing} onClose={() => setPreviewing(null)} />

      <RequestDetailDrawer
        requestId={viewing}
        onClose={() => setViewing(null)}
        footer={(request) =>
          request.viewer.can_edit ? (
            <button
              type="button"
              onClick={() => navigate(`/documents/edit/${request.request_id}`)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Pencil size={14} />
              {request.status === 'RETURNED' ? 'Fix and send again' : 'Continue editing'}
            </button>
          ) : null
        }
      />
    </div>
  );
}
