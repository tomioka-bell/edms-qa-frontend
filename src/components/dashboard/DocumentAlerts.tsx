import { DOC_ALERTS } from '../../data/mockDashboard';
import type { AlertKind } from '../../data/mockDashboard';
import { cn } from '../../lib/cn';
import DashCard from './DashCard';

const KIND: Record<AlertKind, { tag: string; label: string; tile: string; pill: string }> = {
  expired: {
    tag: 'EX',
    label: 'Expired',
    tile: 'bg-danger-soft text-danger-strong',
    pill: 'bg-danger-soft text-danger',
  },
  'review-due': {
    tag: 'RV',
    label: 'Review due',
    tile: 'bg-[#FFF6E0] text-[#C27C0E]',
    pill: 'bg-[#FFF3EA] text-[#D9580F]',
  },
  expiring: {
    tag: 'EP',
    label: 'Expiring',
    tile: 'bg-[#FFF3EA] text-[#D9580F]',
    pill: 'bg-[#FFF3EA] text-[#D9580F]',
  },
};

export default function DocumentAlerts() {
  return (
    <DashCard title="Document alerts" action={{ label: 'View all', to: '/documents/expiring' }} bodyClassName="px-5 py-1">
      <ul>
        {DOC_ALERTS.map((a) => {
          const k = KIND[a.kind];
          return (
            <li key={a.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
              <span
                aria-hidden="true"
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold', k.tile)}
              >
                {k.tag}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink" title={`${a.code} ${a.title}`}>
                  {a.code} {a.title}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted">{a.detail}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium', k.pill)}>
                {k.label}
              </span>
            </li>
          );
        })}
      </ul>
    </DashCard>
  );
}
