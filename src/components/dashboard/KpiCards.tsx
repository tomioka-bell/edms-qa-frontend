import { FileText, CircleCheck, Clock, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KPIS } from '../../data/mockDashboard';
import type { Kpi } from '../../data/mockDashboard';
import { cn } from '../../lib/cn';

const ICON: Record<Kpi['key'], { icon: LucideIcon; tile: string }> = {
  total: { icon: FileText, tile: 'bg-brand-50 text-brand-500' },
  active: { icon: CircleCheck, tile: 'bg-ok-soft text-ok' },
  pending: { icon: Clock, tile: 'bg-attn-soft text-attn' },
  compliance: { icon: ShieldCheck, tile: 'bg-[#FEF9C3] text-[#A16207]' },
};

function Delta({ kpi }: { kpi: Kpi }) {
  const up = kpi.delta >= 0;
  const good = up === kpi.upIsGood;
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold',
        good ? 'bg-ok-soft text-[#15803D]' : 'bg-danger-soft text-danger-strong',
      )}
    >
      <span aria-hidden="true" className="text-[9px]">{up ? '▲' : '▼'}</span>
      {Math.abs(kpi.delta)}%
      <span className="sr-only">{up ? 'increase' : 'decrease'} vs. last month</span>
    </span>
  );
}

export default function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPIS.map((kpi) => {
        const { icon: Icon, tile } = ICON[kpi.key];
        return (
          <div key={kpi.key} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between">
              <span className={cn('flex size-10 items-center justify-center rounded-lg', tile)}>
                <Icon size={19} strokeWidth={1.85} aria-hidden="true" />
              </span>
              <Delta kpi={kpi} />
            </div>
            <p className="mt-4 text-[13.5px] text-muted">{kpi.label}</p>
            <p className="tnum mt-0.5 text-[30px] leading-tight font-bold tracking-[-0.02em] text-ink">{kpi.value}</p>
            <p className="mt-1.5 truncate text-[12.5px] text-muted">{kpi.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
