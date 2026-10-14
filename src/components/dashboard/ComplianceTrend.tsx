import { useEffect, useRef, useState } from 'react';
import { COMPLIANCE_TREND } from '../../data/mockDashboard';
import DashCard from './DashCard';

const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 36 };
const TICKS = [0, 25, 50, 75, 100];

const { months, series } = COMPLIANCE_TREND;

export default function ComplianceTrend() {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the card's real width so axis text stays at its designed size instead of scaling with the SVG.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(Math.round(entry.contentRect.width), 240)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const x = (i: number) => PAD.left + (i / (months.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / 100) * (H - PAD.top - PAD.bottom);
  const linePath = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const areaPath = (values: number[]) => `${linePath(values)} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <DashCard title="Compliance trend" action={{ note: 'last 12 months' }}>
      <div ref={box} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block overflow-visible"
          role="img"
          aria-label="Compliance and on-time review percentage over the last 12 months"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.14" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Recessive grid + y axis */}
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#F1F1F4" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10.5" fill="#71717A">
                {t}%
              </text>
            </g>
          ))}
          {months.map((m, i) => (
            <text key={m} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#71717A">
              {m}
            </text>
          ))}

          {series.map((s) => (
            <path key={`a-${s.key}`} d={areaPath(s.values)} fill={`url(#trend-${s.key})`} />
          ))}
          {series.map((s) => (
            <path
              key={`l-${s.key}`}
              d={linePath(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Crosshair */}
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="#A1A1AA" strokeDasharray="3 3" />
          )}
          {series.map((s) =>
            s.values.map((v, i) => (
              <circle
                key={`${s.key}-${i}`}
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 4.5 : 3}
                fill="#FFFFFF"
                stroke={s.color}
                strokeWidth="2"
              />
            )),
          )}

          {/* Hit targets: one column per month, wider than the marks */}
          {months.map((m, i) => (
            <rect
              key={`hit-${m}`}
              x={x(i) - (W - PAD.left - PAD.right) / (months.length - 1) / 2}
              y={PAD.top}
              width={(W - PAD.left - PAD.right) / (months.length - 1)}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hover != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-pop"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-ink">{months[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-ink-2">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tnum font-semibold text-ink">{s.values[hover]}%</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </DashCard>
  );
}
