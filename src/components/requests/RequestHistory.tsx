import { Ban, Check, Files, PencilLine, Send, Truck, Undo2 } from 'lucide-react';
import type { DocumentRequest, RequestHistoryEntry } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';

const HISTORY: Record<RequestHistoryEntry['action'], { icon: typeof Send; cls: string; text: (h: RequestHistoryEntry) => string }> = {
  SUBMIT: { icon: Send, cls: 'bg-info-soft text-info', text: () => 'Sent for approval' },
  RESUBMIT: { icon: Send, cls: 'bg-info-soft text-info', text: (h) => `Sent again (round ${h.round})` },
  APPROVE: { icon: Check, cls: 'bg-ok-soft text-[#15803D]', text: (h) => `Approved step ${h.step_no}` },
  REJECT: { icon: Undo2, cls: 'bg-warn-soft text-[#A16207]', text: (h) => `Sent back at step ${h.step_no}` },
  CANCEL: { icon: Ban, cls: 'bg-danger-soft text-danger-strong', text: () => 'Cancelled' },
  RECALL: { icon: PencilLine, cls: 'bg-[#F4F4F5] text-ink-2', text: () => 'Taken back to change' },
  SUPPLIER_SUBMIT: { icon: Truck, cls: 'bg-[#F5F3FF] text-[#6D28D9]', text: () => 'Filled in and signed by the supplier' },
  SUPPLIER_RETURN: { icon: Undo2, cls: 'bg-warn-soft text-[#A16207]', text: () => 'Sent back by the supplier' },
};

/** What has happened to a request, newest first: who sent, approved, sent back or cancelled it, and what they said. */
export default function RequestHistory({
  request,
  onViewRound,
}: {
  request: Pick<DocumentRequest, 'history' | 'created_at' | 'rounds'>;
  /** When given, each sending gets a button that opens the documents as they were sent in that round. */
  onViewRound?: (round: number) => void;
}) {
  if (request.history.length === 0) {
    return <p className="text-[12.5px] text-faint italic">Not sent yet. Created {dayjs(request.created_at).format('DD MMM YYYY HH:mm')}.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {[...request.history].reverse().map((h, i) => {
        const kind = HISTORY[h.action];
        const Icon = kind.icon;
        return (
          <li key={i} className="flex items-start gap-3">
            <span className={cn('mt-px flex size-6 shrink-0 items-center justify-center rounded-full', kind.cls)}>
              <Icon size={12} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-ink-2">
                <span className="font-semibold text-ink">{kind.text(h)}</span> by {h.actor_name || h.actor_code}
              </p>
              <p className="tnum text-[11.5px] text-muted">{dayjs(h.created_at).format('DD MMM YYYY HH:mm')}</p>
              {h.comment && <p className="mt-1 rounded-md border border-line bg-[#FAFAFB] px-2.5 py-1.5 text-[12px] leading-relaxed text-ink-2">“{h.comment}”</p>}
              {onViewRound && (h.action === 'SUBMIT' || h.action === 'RESUBMIT') && request.rounds.some((r) => r.round === h.round) && (
                <button
                  type="button"
                  onClick={() => onViewRound(h.round)}
                  className="mt-1.5 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Files size={13} />
                  Documents as sent in round {h.round}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
