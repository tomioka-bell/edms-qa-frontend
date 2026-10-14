import { useState } from 'react';
import { documentStats } from '../../data/mockDocuments';
import { fmtNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

const SIZE = 168;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2 - 3;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between slices, in px along the ring. */
const GAP = 2;

export default function DocumentCategories() {
  const data = documentStats.byCategory;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [hover, setHover] = useState<string | null>(null);

  const slices = data.map((d, i) => {
    const start = data.slice(0, i).reduce((sum, s) => sum + s.value, 0);
    const length = (d.value / total) * CIRCUMFERENCE;
    return { ...d, dash: Math.max(length - GAP, 0), offset: (start / total) * CIRCUMFERENCE };
  });

  const focused = data.find((d) => d.label === hover);

  return (
    <section className="panel flex h-fit flex-col">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Documents by Category</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Share of the register by document type</p>
        </div>
        <span className="tnum text-[12px] text-muted">{fmtNumber(total)} total</span>
      </div>

      <div className="flex flex-col items-center gap-4 p-5">
        {/* Donut — the centre doubles as the hover readout */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            role="img"
            aria-label={`Documents by category: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
          >
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-line-soft)" strokeWidth={STROKE} />
            {slices.map((s) => (
              <circle
                key={s.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.label ? STROKE + 5 : STROKE}
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                strokeDashoffset={-s.offset}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default transition-[opacity,stroke-width] duration-200 motion-reduce:transition-none"
                style={{ opacity: hover && hover !== s.label ? 0.3 : 1 }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="tnum text-[22px] leading-none font-semibold tracking-[-0.02em] text-ink">
              {fmtNumber(focused?.value ?? total)}
            </span>
            <span className="mt-1.5 text-[11.5px] text-muted">
              {focused ? `${((focused.value / total) * 100).toFixed(1)}%` : 'documents'}
            </span>
            {focused && <span className="mt-0.5 max-w-[104px] truncate text-[11px] font-medium text-ink-2">{focused.label}</span>}
          </div>
        </div>

        {/* Legend / breakdown — every slice named with its value, so identity never rests on colour */}
        <ul className="flex w-full min-w-0 flex-col">
          {data.map((d) => {
            const pct = (d.value / total) * 100;
            return (
              <li
                key={d.label}
                onMouseEnter={() => setHover(d.label)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  '-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150',
                  hover === d.label && 'bg-[#FAFAFB]',
                )}
              >
                <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">{d.label}</span>
                <span className="tnum text-[11.5px] text-faint">{pct.toFixed(1)}%</span>
                <span className="tnum w-10 text-right text-[13.5px] font-semibold text-ink">{fmtNumber(d.value)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
