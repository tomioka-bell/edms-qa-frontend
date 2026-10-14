import { useState } from 'react';
import { LIFECYCLE, TOTAL_DOCUMENTS } from '../../data/mockDashboard';
import { cn } from '../../lib/cn';
import DashCard from './DashCard';

/** Drawing units — the donut is scaled to the card via CSS, so these only set its proportions. */
const SIZE = 200;
const STROKE = 30;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
/** 2px surface gap between segments, measured along the ring. */
const GAP = 2;

const pct = (n: number) => Math.round((n / TOTAL_DOCUMENTS) * 100);

export default function DocumentAnalytics() {
  const [hover, setHover] = useState<number | null>(null);
  const focused = hover == null ? null : LIFECYCLE[hover];

  const arcs = LIFECYCLE.map((s, i) => {
    const len = (s.count / TOTAL_DOCUMENTS) * C;
    const offset = (LIFECYCLE.slice(0, i).reduce((sum, p) => sum + p.count, 0) / TOTAL_DOCUMENTS) * C;
    return { ...s, dash: Math.max(len - GAP, 0.5), offset };
  });

  return (
    <DashCard title="Document analytics" action={{ label: 'View all', to: '/documents' }}>
      {/* Donut left, legend-table right, as in the customer layout. Sizes follow the card width (cqw)
          so the donut stays ~37% of the card and the legend about its height at any breakpoint. */}
      <div className="@container">
      <div className="flex items-center gap-[5cqw]">
        <div className="relative aspect-square w-[37cqw] max-w-55 shrink-0">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width="100%"
            height="100%"
            role="img"
            aria-label={`${TOTAL_DOCUMENTS} documents by lifecycle stage`}
            className="-rotate-90"
          >
            {arcs.map((a, i) => (
              <circle
                key={a.stage}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={hover === i ? STROKE + 4 : STROKE}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={-a.offset}
                opacity={hover == null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-[opacity,stroke-width] duration-150 motion-reduce:transition-none"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="tnum text-[clamp(22px,9cqw,40px)] leading-none font-bold text-ink">
              {focused ? focused.count : TOTAL_DOCUMENTS}
            </span>
            <span className="mt-[0.35em] max-w-[70%] text-[clamp(11px,3.4cqw,14px)] leading-tight text-muted">
              {focused ? focused.stage : 'documents'}
            </span>
          </div>
        </div>

        {/* Legend doubles as the table view */}
        <table className="w-full min-w-0 text-[clamp(12px,3.6cqw,15px)]">
          <caption className="sr-only">Documents by lifecycle stage</caption>
          <tbody>
            {LIFECYCLE.map((s, i) => (
              <tr
                key={s.stage}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={cn('transition-colors', hover === i && 'bg-[#FAFAFB]')}
              >
                <th scope="row" className="w-full max-w-0 py-[clamp(3px,1.1cqw,7px)] pl-1 text-left font-normal text-ink-2">
                  <span className="flex items-center gap-[0.7em]">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate">{s.stage}</span>
                  </span>
                </th>
                <td className="tnum pl-3 text-right font-semibold whitespace-nowrap text-ink">{s.count}</td>
                <td className="tnum pr-1 pl-4 text-right text-[0.9em] whitespace-nowrap text-muted">{pct(s.count)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </DashCard>
  );
}
