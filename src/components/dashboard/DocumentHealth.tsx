import { useState } from 'react';
import { Tooltip } from 'antd';
import { documentStats } from '../../data/mockDocuments';
import { fmtNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

export default function DocumentHealth() {
  const data = documentStats.health;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <section className="panel flex h-fit flex-col">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Document Health</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Lifecycle distribution across the register</p>
        </div>
        <span className="tnum text-[12px] text-muted">{fmtNumber(total)} total</span>
      </div>

      <div className="flex flex-col p-5">
        {/* Stacked bar */}
        <div className="flex h-[10px] w-full gap-[3px] overflow-hidden rounded-full">
          {data.map((d) => (
            <Tooltip key={d.label} title={`${d.label} · ${fmtNumber(d.value)} (${((d.value / total) * 100).toFixed(1)}%)`}>
              <div
                onMouseEnter={() => setHover(d.label)}
                onMouseLeave={() => setHover(null)}
                className="h-full cursor-default rounded-full transition-opacity duration-200 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(d.value / total) * 100}%`,
                  backgroundColor: d.color,
                  opacity: hover && hover !== d.label ? 0.28 : 1,
                }}
              />
            </Tooltip>
          ))}
        </div>

        {/* Legend / breakdown */}
        <ul className="mt-5 flex flex-col">
          {data.map((d) => {
            const pct = (d.value / total) * 100;
            return (
              <li
                key={d.label}
                onMouseEnter={() => setHover(d.label)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  '-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150',
                  hover === d.label && 'bg-[#FAFAFB]',
                )}
              >
                <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="flex-1 text-[13px] font-medium text-ink-2">{d.label}</span>
                <span className="tnum text-[11.5px] text-faint">{pct.toFixed(1)}%</span>
                <span className="tnum w-12 text-right text-[13.5px] font-semibold text-ink">
                  {fmtNumber(d.value)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-start gap-2 border-t border-line pt-4">
          <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-ok" />
          <p className="text-[12px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">82.9%</span> of the register is active and within
            its review cycle.
          </p>
        </div>
      </div>
    </section>
  );
}
