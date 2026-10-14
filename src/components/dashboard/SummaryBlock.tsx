import { ArrowUpRight, CalendarClock, CircleAlert, Stamp, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from 'antd';
import { documentStats } from '../../data/mockDocuments';
import { fmtNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

/** Twelve-week intake sparkline — drawn rather than charted, to stay hairline-fine. */
function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const w = 168;
  const h = 40;
  const step = w / (points.length - 1);

  const coords = points.map((p, i) => [i * step, h - ((p - min) / span) * (h - 6) - 3] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1F4A8F" stopOpacity="0.14" />
          <stop offset="1" stopColor="#1F4A8F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#1F4A8F" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#1F4A8F" stroke="#FFFFFF" strokeWidth="1.75" />
    </svg>
  );
}

interface SecondaryProps {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: 'brand' | 'danger' | 'warn' | 'neutral';
  /** Week-over-week movement; negative is an improvement for these metrics. */
  delta: number;
  onClick?: () => void;
}

function SecondaryMetric({ label, value, hint, icon: Icon, tone, delta, onClick }: SecondaryProps) {
  const accent = {
    brand: 'bg-brand-500',
    danger: 'bg-danger',
    warn: 'bg-warn',
    neutral: 'bg-[#D4D4D8]',
  }[tone];
  const iconCls = {
    brand: 'text-brand-500',
    danger: 'text-danger-strong',
    warn: 'text-warn',
    neutral: 'text-faint',
  }[tone];
  // For a queue metric, fewer is better — so a drop reads as good news.
  const improving = delta < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full flex-col px-5 py-4 text-left transition-colors duration-150 hover:bg-[#FAFAFB]"
    >
      {/* 2px accent rule — the "small red accent line" */}
      <span className={cn('absolute top-4 bottom-4 left-0 w-0.5 rounded-full', accent)} />

      <div className="flex items-center gap-1.5">
        <Icon size={14} strokeWidth={1.9} className={iconCls} />
        <p className="truncate text-[12.5px] font-medium text-muted">{label}</p>
        <ArrowUpRight
          size={14}
          className="ml-auto shrink-0 text-[#D4D4D8] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em]">{value}</p>
        <span
          className={cn('tnum text-[11.5px] font-semibold', improving ? 'text-ok' : 'text-muted')}
        >
          {delta > 0 ? '+' : ''}
          {delta} vs last week
        </span>
      </div>

      <p className="mt-1 text-[12px] text-muted">{hint}</p>
    </button>
  );
}

export default function SummaryBlock({ onDrill }: { onDrill: (status: string) => void }) {
  const s = documentStats;
  const trend = [58, 62, 59, 71, 68, 76, 74, 83, 79, 88, 94, 102];

  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ── Primary metric ──────────────────────────── */}
        <div className="relative border-b border-line px-6 py-4 xl:border-r xl:border-b-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-muted">Total Controlled Documents</p>
              <p className="tnum mt-1.5 text-[34px] leading-none font-bold tracking-[-0.032em] text-ink">
                {fmtNumber(s.total)}
              </p>
            </div>
            <Tooltip title="Documents added over the last 12 weeks">
              <div className="mt-1 shrink-0">
                <Sparkline points={trend} />
              </div>
            </Tooltip>
          </div>

          {/* Supporting figures sit inline, separated by dividers rather than
              boxed into their own cards — keeps the block shallow. */}
          <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md bg-line text-[12px]">
            <div className="bg-surface pr-2">
              <dt className="text-[11px] text-muted">This month</dt>
              <dd className="tnum mt-0.5 inline-flex items-center gap-1 font-semibold text-[#15803D]">
                <TrendingUp size={12.5} strokeWidth={2.2} />+{s.addedThisMonth}
              </dd>
            </div>
            <div className="bg-surface px-2">
              <dt className="text-[11px] text-muted">Controlled copies</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-2">1,246</dd>
            </div>
            <div className="bg-surface px-2">
              <dt className="text-[11px] text-muted">Avg. approval</dt>
              <dd className="tnum mt-0.5 font-semibold text-ink-2">3.4 days</dd>
            </div>
          </dl>
        </div>

        {/* ── Secondary metrics ───────────────────────── */}
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <SecondaryMetric
            label="Pending Approval"
            value={s.pendingApproval}
            hint={`${s.requiresMyAction} require your action`}
            icon={Stamp}
            tone="brand"
            delta={-4}
            onClick={() => onDrill('Pending Approval')}
          />
          <SecondaryMetric
            label="Expiring Soon"
            value={s.expiringSoon}
            hint="Within 30 days"
            icon={CalendarClock}
            tone="warn"
            delta={3}
            onClick={() => onDrill('Expiring Soon')}
          />
          <SecondaryMetric
            label="Overdue Review"
            value={s.overdueReview}
            hint="Needs immediate attention"
            icon={CircleAlert}
            tone="danger"
            delta={2}
            onClick={() => onDrill('Expired')}
          />
        </div>
      </div>
    </section>
  );
}
