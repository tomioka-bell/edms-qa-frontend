import { Tooltip } from 'antd';
import { WORKLOAD } from '../../data/mockDashboard';
import DashCard from './DashCard';

const MAX = Math.max(...WORKLOAD.map((w) => w.count));

/** One measure across departments — a single-hue bar list, sorted. */
export default function WorkloadOverview() {
  return (
    <DashCard title="Workload overview" action={{ note: 'documents by department' }}>
      <ul className="flex flex-col gap-2.5">
        {WORKLOAD.map((w) => (
          <li key={w.code} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_1.25rem] items-center gap-3">
            <span className="truncate text-[13px] text-ink-2" title={`${w.code} · ${w.department}`}>
              {w.code} · {w.department}
            </span>
            <Tooltip title={`${w.department}: ${w.count} documents`}>
              <span className="block h-3.5 rounded-[4px] bg-[#EDEEF2]">
                <span
                  className="block h-full rounded-[4px] bg-[#4169E1]"
                  style={{ width: `${(w.count / MAX) * 100}%` }}
                />
              </span>
            </Tooltip>
            <span className="tnum text-right text-[13px] font-semibold text-ink">{w.count}</span>
          </li>
        ))}
      </ul>
    </DashCard>
  );
}
