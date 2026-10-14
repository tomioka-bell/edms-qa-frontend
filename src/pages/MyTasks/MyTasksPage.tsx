import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Segmented, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CircleCheckBig, Clock3, Eye, FileText, RotateCw, Search, ServerCrash, Workflow } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/common/PageHeader';
import RequestStatusTag, { DocTypeTag } from '../../components/requests/RequestStatusTag';
import { ApiError } from '../../lib/api';
import { listDocumentRequests } from '../../lib/documentRequests';
import { revisionLabel } from '../../lib/documentTemplates';
import { useInboxStore } from '../../stores/inbox';
import { useCurrentUser } from '../../stores/session';
import type { DocumentRequest, RequestApprover } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import ValidUntilTag from '../../components/requests/ValidUntilTag';
import { DUE_TONE, describeDue } from '../../lib/deadlines';

type Tab = 'waiting' | 'done';

// Soft, distinguishable tints for initials; picked by name so a person keeps their colour down the list
const AVATAR_TINTS = ['bg-brand-100 text-brand-700', 'bg-[#DCFCE7] text-[#166534]', 'bg-[#FEF3C7] text-[#92400E]', 'bg-[#FCE7F3] text-[#9D174D]', 'bg-[#E0E7FF] text-[#3730A3]', 'bg-[#CCFBF1] text-[#115E59]'];

/** "Anan K. (Mock)" -> "AK" */
function initialsOf(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

const tintOf = (name: string) => AVATAR_TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];

function Summary({ request }: { request: DocumentRequest }) {
  const Icon = request.doc_type === 'FLOW' ? Workflow : FileText;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100" aria-hidden>
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold text-ink" title={request.title}>
          {request.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="doc-code text-[11.5px] text-brand-600">{request.request_no}</span>
          <DocTypeTag type={request.doc_type} />
          <span className="tnum truncate text-[12px] text-muted">
            {request.doc_code ? `${request.doc_code} ${revisionLabel(request.revision_no)} · ` : ''}
            {request.file_count} {request.file_count === 1 ? 'file' : 'files'}
          </span>
        </p>
      </div>
    </div>
  );
}

/** One short bar per step of the route, coloured by how far the request has got. */
function StepBars({ request }: { request: DocumentRequest }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {request.steps.map((s) => (
        <span
          key={s.step_no}
          className={cn('h-1.5 w-5 rounded-full', s.status === 'APPROVED' ? 'bg-ok' : s.status === 'REJECTED' ? 'bg-danger' : s.status === 'ACTIVE' ? 'bg-brand-500' : 'bg-[#E4E4E7]')}
        />
      ))}
    </span>
  );
}

/**
 * Requests waiting for the signed-in person to approve or send back, and the ones they have already
 * decided. Opening one goes to its own page (/tasks/:id), where the document is shown and decided.
 */
export default function MyTasksPage() {
  const navigate = useNavigate();
  const { employeeCode } = useCurrentUser();
  const setInboxCount = useInboxStore((s) => s.setCount);

  const [waiting, setWaiting] = useState<DocumentRequest[]>([]);
  const [involved, setInvolved] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('waiting');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDocumentRequests('inbox'), listDocumentRequests('all')])
      .then(([inbox, all]) => {
        if (cancelled) return;
        setWaiting(inbox);
        setInvolved(all);
        setInboxCount(inbox.length);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Your tasks could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, setInboxCount]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  /** The signed-in person's own place on a request's route, if they are one of its approvers. */
  const myPlace = (request: DocumentRequest): { stepNo: number; stepName: string; approver: RequestApprover } | null => {
    const me = employeeCode.toLowerCase();
    for (const step of request.steps) {
      const approver = step.approvers.find((a) => me !== '' && a.employee_code.toLowerCase() === me);
      if (approver) return { stepNo: step.step_no, stepName: step.step_name, approver };
    }
    return null;
  };

  // Decided: I approved or sent it back in the current round
  const done = involved.filter((r) => {
    const place = myPlace(r);
    return place !== null && place.approver.decision !== 'PENDING';
  });

  const needle = query.trim().toLowerCase();
  const shown = (tab === 'waiting' ? waiting : done).filter(
    (r) => !needle || `${r.request_no} ${r.title} ${r.doc_code} ${r.requester_name}`.toLowerCase().includes(needle),
  );

  const requester = (r: DocumentRequest) => {
    const name = r.requester_name || r.requester_code;
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', tintOf(name))} aria-hidden>
          {initialsOf(name)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium text-ink-2">{name}</span>
          <span className="truncate text-[12px] text-muted">{r.requester_department_code || r.requester_code}</span>
        </span>
      </span>
    );
  };

  /** When it was sent and how long it has been waiting, which is what tells an approver what to open first. */
  const sent = (r: DocumentRequest) => {
    if (!r.submitted_at) return <span className="text-faint">—</span>;
    const at = dayjs(r.submitted_at);
    const days = dayjs().diff(at, 'day');
    // The step waiting for this person, when it has a time limit
    const dueAt = tab === 'waiting' ? r.steps.find((s) => s.step_no === r.current_step_no && s.status === 'ACTIVE')?.due_at : null;
    const due = dueAt ? describeDue(dueAt) : null;
    return (
      <span className="flex flex-col">
        <span className="tnum text-[13px] whitespace-nowrap text-ink-2">{at.format('DD MMM YYYY')}</span>
        {due && dueAt ? (
          <span
            className={cn('tnum mt-0.5 inline-flex w-fit items-center gap-1 rounded px-1.5 py-px text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset', DUE_TONE[due.tone])}
            title={`Your decision is due ${dayjs(dueAt).format('DD MMM YYYY HH:mm')}`}
          >
            <Clock3 size={11} />
            {due.text}
          </span>
        ) : tab === 'waiting' ? (
          <span className={cn('flex items-center gap-1 text-[12px] whitespace-nowrap', days >= 3 ? 'font-medium text-[#A16207]' : 'text-muted')}>
            <Clock3 size={11} />
            waiting {at.fromNow(true)}
          </span>
        ) : (
          <span className="tnum text-[12px] text-muted">{r.round > 1 ? `round ${r.round}` : at.format('HH:mm')}</span>
        )}
        {/* The last day the document is valid sits with the other dates, where an approver looks for time */}
        <ValidUntilTag request={r} className="mt-1 w-fit" />
      </span>
    );
  };

  const myStep = (r: DocumentRequest) => {
    const place = myPlace(r);
    if (!place) return <span className="text-faint">—</span>;
    const { approver } = place;
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-medium text-ink-2">{place.stepName}</span>
          <span className="tnum shrink-0 text-[12px] text-muted">
            step {place.stepNo} of {r.step_count}
          </span>
        </span>
        <StepBars request={r} />
        {approver.decision === 'PENDING' ? (
          <span className="text-[12px] text-brand-600">{r.round > 1 ? `Sent again (round ${r.round}) · your decision` : 'Waiting for your decision'}</span>
        ) : (
          <span className={approver.decision === 'APPROVED' ? 'text-[12px] text-[#15803D]' : 'text-[12px] text-danger-strong'}>
            You {approver.decision === 'APPROVED' ? 'approved' : 'sent it back'}
            {approver.decided_at ? ` · ${dayjs(approver.decided_at).format('DD MMM YYYY')}` : ''}
          </span>
        )}
      </span>
    );
  };

  const openButton = (r: DocumentRequest) => (
    <button
      type="button"
      onClick={() => navigate(`/tasks/${r.request_id}`)}
      aria-label={`${tab === 'waiting' ? 'Review' : 'View'} ${r.request_no}`}
      className={
        tab === 'waiting'
          ? 'flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-600'
          : 'flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]'
      }
    >
      <Eye size={14} />
      {tab === 'waiting' ? 'Review' : 'View'}
    </button>
  );

  const columns: ColumnsType<DocumentRequest> = [
    // The document takes whatever room is left; the other columns are sized to what they hold
    { title: 'Document', key: 'document', render: (_, r) => <Summary request={r} /> },
    { title: 'From', key: 'from', width: 200, render: (_, r) => requester(r) },
    { title: tab === 'waiting' ? 'Your step' : 'Your decision', key: 'step', width: 250, render: (_, r) => myStep(r) },
    { title: 'Sent', key: 'sent', width: 190, render: (_, r) => sent(r) },
    ...(tab === 'done' ? [{ title: 'Now', key: 'status', width: 130, render: (_: unknown, r: DocumentRequest) => <RequestStatusTag status={r.status} /> }] : []),
    { title: '', key: 'actions', width: 116, align: 'right', render: (_, r) => openButton(r) },
  ];

  const emptyState =
    needle !== '' ? (
      <EmptyState compact title="Nothing matches" description="Try a different search." />
    ) : tab === 'waiting' ? (
      <EmptyState
        icon={<CircleCheckBig size={19} strokeWidth={1.75} />}
        title="Nothing is waiting for you"
        description="Documents that need your approval will show up here."
      />
    ) : (
      <EmptyState compact title="No decisions yet" description="Documents you approve or send back are listed here." />
    );

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Overview" title="My Tasks" description="Documents waiting for you to approve or send back." />

      <div className="anim-rise panel mt-6 overflow-hidden">
        {loadError ? (
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title="Your tasks could not be loaded"
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
              <Segmented
                value={tab}
                onChange={(value) => setTab(value as Tab)}
                aria-label="Which tasks to show"
                options={[
                  { value: 'waiting', label: `Waiting for me ${waiting.length}` },
                  { value: 'done', label: `Decided ${done.length}` },
                ]}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                allowClear
                prefix={<Search size={15} className="text-faint" />}
                placeholder="Search by number, title, or requester"
                aria-label="Search my tasks"
                className="w-full! sm:ml-auto sm:w-72!"
              />
            </div>

            {/* Narrow windows: one card per request */}
            <div className="xl:hidden">
              {loading ? (
                <div className="grid h-40 place-items-center">
                  <Spin />
                </div>
              ) : shown.length === 0 ? (
                emptyState
              ) : (
                <ul className="divide-y divide-line">
                  {shown.map((r) => (
                    <li key={r.request_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <Summary request={r} />
                        <div className="shrink-0">{openButton(r)}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                        {requester(r)}
                        {sent(r)}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {myStep(r)}
                        {tab === 'done' && <RequestStatusTag status={r.status} />}
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
                dataSource={shown}
                loading={loading}
                pagination={shown.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                scroll={{ x: 980 }}
                locale={{ emptyText: loading ? <div className="h-40" /> : emptyState }}
                // The whole row opens the document, not just the button
                onRow={(r) => ({ onClick: () => navigate(`/tasks/${r.request_id}`), className: 'cursor-pointer' })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
