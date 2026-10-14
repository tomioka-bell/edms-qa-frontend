import { APPROVAL_PERFORMANCE as P } from '../../data/mockDashboard';
import DashCard from './DashCard';

export default function ApprovalPerformance() {
  return (
    <DashCard title="Approval performance" action={{ label: 'Open queue', to: '/control/approval' }}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-[#FAFAFB] px-4 py-3.5">
          <p className="text-[12.5px] text-muted">Avg. approval lead time</p>
          <p className="mt-1.5 text-ink">
            <span className="tnum text-[26px] leading-none font-bold">{P.avgLeadDays}</span>
            <span className="ml-1.5 text-[13px] text-muted">days</span>
          </p>
        </div>
        <div className="rounded-lg border border-line bg-[#FAFAFB] px-4 py-3.5">
          <p className="text-[12.5px] text-muted">Overdue approvals</p>
          <p className="tnum mt-1.5 text-[26px] leading-none font-bold text-danger">{P.overdue}</p>
        </div>
      </div>

      {/* The overdue approvals themselves */}
      <ul className="mt-3">
        {P.overdueItems.map((item) => (
          <li key={item.code} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
            <span
              aria-label={`Step ${item.step}`}
              className="tnum flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F3EEFF] text-[12.5px] font-bold text-[#7C3AED]"
            >
              {item.step}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink" title={`${item.code} ${item.title}`}>
                {item.code} {item.title}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-muted">
                {item.role} · {item.name}
              </p>
            </div>
            <span className="tnum shrink-0 rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] font-medium text-danger">
              Overdue {item.days}d
            </span>
          </li>
        ))}
      </ul>
    </DashCard>
  );
}
