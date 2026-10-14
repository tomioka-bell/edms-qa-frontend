import { Check, Clock, Minus } from 'lucide-react';
import type { ApprovalStep } from '../../types/document';
import { fmtDate } from '../../lib/format';
import { cn } from '../../lib/cn';

const STATE = {
  Completed: {
    ring: 'bg-ok text-white ring-ok/20',
    icon: Check,
    label: 'Completed',
    labelCls: 'text-[#15803D] bg-ok-soft ring-[#BBF7D0]',
  },
  'In Progress': {
    ring: 'bg-brand-500 text-white ring-brand-500/20',
    icon: Clock,
    label: 'In Progress',
    labelCls: 'text-brand-700 bg-brand-50 ring-brand-200',
  },
  Pending: {
    ring: 'bg-surface text-faint ring-line',
    icon: Minus,
    label: 'Pending',
    labelCls: 'text-muted bg-[#F4F4F5] ring-[#E4E4E7]',
  },
  Rejected: {
    ring: 'bg-danger text-white ring-danger/20',
    icon: Minus,
    label: 'Returned',
    labelCls: 'text-danger-strong bg-danger-soft ring-danger-ring',
  },
} as const;

export default function ApprovalTimeline({ steps }: { steps: ApprovalStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const s = STATE[step.state];
        const Icon = s.icon;
        const isLast = i === steps.length - 1;

        return (
          <li key={step.role} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-7.5 bottom-0 left-3.25 w-0.5',
                  step.state === 'Completed' ? 'bg-ok/30' : 'bg-line',
                )}
              />
            )}

            <span
              className={cn(
                'relative z-10 flex size-6.75 shrink-0 items-center justify-center rounded-full ring-2',
                s.ring,
              )}
            >
              <Icon size={14} strokeWidth={2.6} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-medium text-muted">{step.role}</p>
                <span
                  className={cn(
                    'rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold ring-1 ring-inset',
                    s.labelCls,
                  )}
                >
                  {s.label}
                </span>
              </div>
              <p className="mt-0.5 text-[13.5px] font-semibold text-ink">{step.name}</p>
              <p className="mt-px text-[12px] text-muted">
                {step.position}
                {step.date && <span className="text-faint"> · {fmtDate(step.date)}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
