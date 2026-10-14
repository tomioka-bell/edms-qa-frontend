import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Dropdown, Spin } from 'antd';
import { BellRing, CalendarClock, Check, CircleCheckBig, FileClock, Undo2 } from 'lucide-react';
import { listDocumentRequests, sentBackBySupplier, takenBackByRequester } from '../../lib/documentRequests';
import { useInboxStore } from '../../stores/inbox';
import { useCurrentUser } from '../../stores/session';
import type { DocumentRequest } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { EXPIRING_SOON_DAYS, daysUntilExpiry } from '../../lib/deadlines';

/** One thing waiting for the signed-in person: a document to decide, or one of their own that came back. */
interface Notice {
  /** Changes when the same document comes round again, so it counts as new again */
  key: string;
  kind: 'decide' | 'returned' | 'expiring';
  title: string;
  detail: string;
  at: string | null;
  /** Where clicking it goes */
  to: string;
}

const TONE = {
  decide: { icon: FileClock, cls: 'text-brand-500 bg-brand-50' },
  returned: { icon: Undo2, cls: 'text-warn bg-warn-soft' },
  expiring: { icon: CalendarClock, cls: 'text-[#A16207] bg-warn-soft' },
} as const;

// How often the list is fetched again while the app is open
const REFRESH_MS = 60_000;

function noticesFrom(inbox: DocumentRequest[], mine: DocumentRequest[], involved: DocumentRequest[]): Notice[] {
  const toDecide = inbox.map((r): Notice => {
    const step = r.steps.find((s) => s.step_no === r.current_step_no);
    return {
      key: `decide:${r.request_id}:${r.round}:${r.current_step_no}`,
      kind: 'decide',
      title: `${r.requester_name || r.requester_code} sent you a document${step ? ` to ${step.step_name.toLowerCase()}` : ''}`,
      detail: `${r.request_no} · ${r.title}${r.round > 1 ? ` · round ${r.round}` : ''}`,
      at: r.submitted_at,
      to: `/tasks/${r.request_id}`,
    };
  });
  const returned = mine
    // Not the ones the requester took back themselves: that is no news to them
    .filter((r) => r.status === 'RETURNED' && !takenBackByRequester(r))
    .map((r): Notice => {
      const by =
        sentBackBySupplier(r) && r.supplier
          ? { name: r.supplier.name, comment: r.supplier.comment, decided_at: r.supplier.done_at }
          : r.steps.flatMap((s) => s.approvers).find((a) => a.decision === 'REJECTED');
      return {
        key: `returned:${r.request_id}:${r.round}`,
        kind: 'returned',
        title: `${by?.name ?? 'An approver'} sent your document back`,
        detail: `${r.request_no} · ${r.title}${by?.comment ? ` · “${by.comment}”` : ''}`,
        at: by?.decided_at ?? r.updated_at,
        to: '/documents/returned',
      };
    });
  // Approved documents the person made or approved, in their last month or past it. Everyone in
  // the document's loop is told, not only whoever made it.
  const expiring = involved
    .filter((r) => r.status === 'APPROVED' && r.valid_until && daysUntilExpiry(r.valid_until) <= EXPIRING_SOON_DAYS)
    .map((r): Notice => {
      const days = daysUntilExpiry(r.valid_until ?? '');
      const when = days < 0 ? 'has expired' : days === 0 ? 'expires today' : `expires in ${days} ${days === 1 ? 'day' : 'days'}`;
      return {
        // "soon" and "over" are separate news: the second shows as new again
        key: `expiring:${r.request_id}:${days < 0 ? 'over' : 'soon'}`,
        kind: 'expiring',
        title: `${r.title} ${when}`,
        detail: `${r.request_no} · valid until ${dayjs(r.valid_until).format('DD MMM YYYY')}`,
        // Sorted by the day it ends: the nearest first among these, and never ahead of today's work
        at: null,
        to: `/tasks/${r.request_id}`,
      };
    });
  // Newest first; the expiry reminders, which have no moment of their own, follow
  return [...[...toDecide, ...returned].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')), ...expiring];
}

const seenStorageKey = (employeeCode: string) => `qa.notifications.seen.${employeeCode}`;

function readSeen(employeeCode: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(seenStorageKey(employeeCode)) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The bell: documents sent to the signed-in person to decide, and their own documents that were
 * sent back. Which ones they have already looked at is remembered in this browser only.
 */
export default function NotificationMenu() {
  const navigate = useNavigate();
  const { employeeCode, signedIn } = useCurrentUser();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [seenBy, setSeenBy] = useState<{ employeeCode: string; keys: string[] }>({ employeeCode: '', keys: [] });
  const [open, setOpen] = useState(false);
  // Bumped to fetch again: when the menu opens
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const load = () =>
      Promise.all([listDocumentRequests('inbox'), listDocumentRequests('mine'), listDocumentRequests('all')])
        .then(([inbox, mine, involved]) => {
          if (cancelled) return;
          setNotices(noticesFrom(inbox, mine, involved));
          // The same two lists feed the numbers in the menu on the left; keep them in step
          useInboxStore.setState({ count: inbox.length, returned: mine.filter((r) => r.status === 'RETURNED').length });
        })
        .catch(() => {
          if (!cancelled) setNotices((was) => was ?? []);
        });
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [signedIn, employeeCode, tick]);

  // What this person has looked at; read again when someone else signs in (or a test user is switched to)
  const seen = seenBy.employeeCode === employeeCode ? seenBy.keys : readSeen(employeeCode);
  const items = notices ?? [];
  const unread = items.filter((n) => !seen.includes(n.key)).length;

  const markSeen = (keys: string[]) => {
    // Forget keys of things no longer listed, so the record does not grow for ever
    const live = new Set(items.map((n) => n.key));
    const next = [...new Set([...seen, ...keys])].filter((k) => live.has(k));
    setSeenBy({ employeeCode, keys: next });
    try {
      localStorage.setItem(seenStorageKey(employeeCode), JSON.stringify(next));
    } catch {
      /* storage unavailable: remembered until the page is reloaded */
    }
  };

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTick((t) => t + 1);
      }}
      trigger={['click']}
      placement="bottomRight"
      popupRender={() => (
        <div className="w-91.5 max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-[13.5px] font-semibold">Notifications</p>
              {unread > 0 && (
                <span className="tnum rounded-[5px] bg-brand-50 px-1.5 py-px text-[11px] font-semibold text-brand-700">{unread} new</span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markSeen(items.map((n) => n.key))}
                className="flex items-center gap-1 text-[12px] font-medium text-green-500 transition-colors hover:text-green-600"
              >
                <Check size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="slim-scroll max-h-92 overflow-y-auto">
            {notices === null ? (
              <div className="grid h-28 place-items-center">
                <Spin size="small" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-9 text-center">
                <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-[#FAFAFB] text-faint">
                  <CircleCheckBig size={18} strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-[13.5px] font-semibold text-ink">You are all caught up</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">Documents sent to you, yours that are sent back, and ones about to expire show up here.</p>
              </div>
            ) : (
              items.map((n) => {
                const { icon: Icon, cls } = TONE[n.kind];
                const isNew = !seen.includes(n.key);
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => {
                      markSeen([n.key]);
                      setOpen(false);
                      navigate(n.to);
                    }}
                    className={cn(
                      'flex w-full gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#FAFAFB]',
                      isNew && 'bg-brand-50/40',
                    )}
                  >
                    <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md', cls)}>
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className={cn('block flex-1 text-[13px] leading-snug', isNew ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{n.title}</span>
                        {isNew && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-muted">{n.detail}</span>
                      {n.at && <span className="mt-1.5 block text-[11px] text-faint">{dayjs(n.at).fromNow()}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-line bg-[#FAFAFB] px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/tasks');
              }}
              className="text-[12.5px] font-medium text-ink-2 transition-colors hover:text-brand-600"
            >
              Open My Tasks
            </button>
          </div>
        </div>
      )}
    >
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className={cn(
          'relative flex size-10 shrink-0 items-center justify-center rounded-full border shadow-card transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 motion-reduce:transition-none',
          open
            ? 'border-brand-200 bg-brand-50 text-brand-600'
            : 'border-line bg-surface text-ink-2 hover:border-[#D4D4D8] hover:bg-[#FAFAFB] hover:text-ink',
        )}
      >
        <Badge dot={unread > 0} offset={[-3, 3]} color="#E11D48">
          <BellRing size={19} strokeWidth={1.75} className="text-current" />
        </Badge>
      </button>
    </Dropdown>
  );
}
