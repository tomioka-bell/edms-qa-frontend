import { Tooltip } from 'antd';
import { ArrowRight, Clock, CircleAlert } from 'lucide-react';
import { mockApprovalQueue } from '../../data/mockActivities';
import { revLabel } from '../../lib/format';
import { cn } from '../../lib/cn';

const URGENCY = {
  overdue: { cls: 'text-danger-strong bg-danger-soft ring-danger-ring', icon: CircleAlert },
  today: { cls: 'text-brand-700 bg-brand-50 ring-brand-200', icon: Clock },
  soon: { cls: 'text-[#A16207] bg-warn-soft ring-[#FEF08A]', icon: Clock },
  normal: { cls: 'text-muted bg-[#F4F4F5] ring-[#E4E4E7]', icon: Clock },
} as const;

export default function ApprovalQueue({ onReview }: { onReview: (code: string) => void }) {
  const items = mockApprovalQueue;
  const actionable = items.filter((i) => i.urgency === 'overdue' || i.urgency === 'today').length;

  return (
    <section className="panel flex flex-col">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Approval Queue</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {items.length} documents awaiting your action
          </p>
        </div>
        {actionable > 0 && (
          <span className="shrink-0 rounded-md bg-danger-soft px-2 py-1 text-[11.5px] font-semibold text-danger-strong ring-1 ring-inset ring-danger-ring">
            {actionable} urgent
          </span>
        )}
      </div>

      <ul className="flex-1 divide-y divide-line-soft">
        {items.map((item) => {
          const u = URGENCY[item.urgency];
          const UIcon = u.icon;
          return (
            <li
              key={item.id}
              className="group flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-[#FAFAFB]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="doc-code text-brand-600">{item.code}</span>
                  <span className="text-[11.5px] text-faint">·</span>
                  <span className="tnum text-[11.5px] font-medium text-muted">
                    {revLabel(item.revision)}
                  </span>
                  <span className="rounded-[4px] border border-line bg-[#FAFAFB] px-1.5 text-[10.5px] font-medium text-muted">
                    {item.stage}
                  </span>
                </div>
                <p className="mt-1 truncate text-[13.5px] font-medium text-ink">{item.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[12px] text-muted">Owner: {item.owner}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium ring-1 ring-inset',
                      u.cls,
                    )}
                  >
                    <UIcon size={11} strokeWidth={2.2} />
                    {item.dueLabel}
                  </span>
                </div>
              </div>

              <Tooltip title={`Open ${item.code} for ${item.stage.toLowerCase()}`}>
                <button
                  type="button"
                  onClick={() => onReview(item.code)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-all duration-150 group-hover:border-brand-200 group-hover:bg-brand-50 group-hover:text-brand-700"
                >
                  Review
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-5 py-3">
        <button
          type="button"
          onClick={() => onReview('all')}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:text-brand-600"
        >
          View full approval queue
          <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}
