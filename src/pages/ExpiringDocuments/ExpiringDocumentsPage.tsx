import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Segmented, Spin } from 'antd';
import { CalendarClock, Eye, RotateCw, ServerCrash } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { ApiError } from '../../lib/api';
import { listDocumentRequests } from '../../lib/documentRequests';
import type { DocumentRequest } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { EXPIRING_SOON_DAYS } from '../../lib/deadlines';

const SOON_DAYS = EXPIRING_SOON_DAYS;

type Tab = 'soon' | 'expired' | 'all';

/** How long is left, or how long ago it ended, with the colour that goes with it. */
function timeLeft(request: DocumentRequest): { text: string; cls: string } {
  const end = dayjs(request.expires_at);
  const days = end.startOf('day').diff(dayjs().startOf('day'), 'day');
  if (request.expired || days < 0) {
    const ago = Math.abs(days);
    return { text: ago === 0 ? 'Expired today' : `Expired ${ago} ${ago === 1 ? 'day' : 'days'} ago`, cls: 'bg-danger-soft text-danger-strong ring-danger-ring' };
  }
  if (days === 0) return { text: 'Expires today', cls: 'bg-warn-soft text-[#A16207] ring-[#FEF08A]' };
  if (days <= SOON_DAYS) return { text: `${days} ${days === 1 ? 'day' : 'days'} left`, cls: 'bg-warn-soft text-[#A16207] ring-[#FEF08A]' };
  return { text: `${days} days left`, cls: 'bg-[#F4F4F5] text-ink-2 ring-[#E4E4E7]' };
}

/**
 * Approved documents that have a validity period: the ones about to run out, the ones that have,
 * and all of them. Covers the documents the signed-in person made or approved.
 */
export default function ExpiringDocumentsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('soon');

  useEffect(() => {
    let cancelled = false;
    listDocumentRequests('all')
      .then((list) => {
        if (cancelled) return;
        // Soonest to expire first
        setRequests(list.filter((r) => r.status === 'APPROVED' && r.expires_at).sort((a, b) => (a.expires_at ?? '').localeCompare(b.expires_at ?? '')));
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Could not load the documents.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const horizon = dayjs().add(SOON_DAYS, 'day');
  const expired = requests.filter((r) => r.expired);
  const soon = requests.filter((r) => !r.expired && dayjs(r.expires_at).isBefore(horizon));
  const shown = tab === 'soon' ? soon : tab === 'expired' ? expired : requests;

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Documents"
        title="Expiring Documents"
        description={`Approved documents that are valid until a set day. “Expiring soon” looks ${SOON_DAYS} days ahead.`}
      />

      <div className="anim-rise panel mt-6 overflow-hidden">
        {loadError ? (
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title="The documents could not be loaded"
            description={loadError.message}
            action={
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setReloadKey((k) => k + 1);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                <RotateCw size={14} />
                Try again
              </button>
            }
          />
        ) : (
          <>
            <div className="border-b border-line px-4 py-3">
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'soon', label: `Expiring soon ${soon.length}` },
                  { value: 'expired', label: `Expired ${expired.length}` },
                  { value: 'all', label: `All ${requests.length}` },
                ]}
              />
            </div>

            {loading ? (
              <div className="grid h-40 place-items-center">
                <Spin />
              </div>
            ) : shown.length === 0 ? (
              <EmptyState
                icon={<CalendarClock size={19} strokeWidth={1.75} />}
                title={tab === 'soon' ? 'Nothing is about to expire' : tab === 'expired' ? 'Nothing has expired' : 'No document has an expiry date yet'}
                description={
                  tab === 'all'
                    ? 'A document gets one when “Valid until” is filled in before it is sent.'
                    : 'Documents show up here as the end of their validity period comes near.'
                }
              />
            ) : (
              <ul className="divide-y divide-line" aria-label="Documents">
                {shown.map((r) => {
                  const left = timeLeft(r);
                  return (
                    <li key={r.request_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                      <div className="min-w-0 flex-1 basis-64">
                        <p className="flex items-center gap-2">
                          <span className="doc-code text-[11.5px] text-brand-600">{r.request_no}</span>
                          {r.doc_code && <span className="doc-code text-[11px] text-muted">{r.doc_code}</span>}
                        </p>
                        <p className="mt-0.5 truncate text-[14px] font-semibold text-ink" title={r.title}>
                          {r.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted">
                          {r.requester_name || r.requester_code}
                          {r.completed_at && ` · approved ${dayjs(r.completed_at).format('DD MMM YYYY')}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn('tnum rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset', left.cls)}>{left.text}</span>
                        <span className="tnum text-[12px] text-muted">{dayjs(r.expires_at).format('DD MMM YYYY')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks/${r.request_id}`)}
                        aria-label={`Open ${r.request_no}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
                      >
                        <Eye size={14} />
                        Open
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
