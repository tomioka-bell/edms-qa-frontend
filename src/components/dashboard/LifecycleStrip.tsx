import { LIFECYCLE } from '../../data/mockDashboard';
import type { LifecycleStage } from '../../data/mockDashboard';
import DashCard from './DashCard';

/** Stages as a left-to-right pipeline; each stage opens its filtered list. */
export default function LifecycleStrip({ onOpen }: { onOpen: (stage: LifecycleStage) => void }) {
  return (
    <DashCard title="Document lifecycle" action={{ note: 'Click a stage to open the list' }}>
      <ol className="grid grid-cols-2 overflow-hidden rounded-lg border border-line sm:grid-cols-4 lg:grid-cols-7">
        {LIFECYCLE.map((s, i) => (
          <li key={s.stage} className="relative border-line [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0">
            <button
              type="button"
              onClick={() => onOpen(s.stage)}
              className="group flex w-full flex-col items-start px-4 py-3.5 text-left transition-colors hover:bg-[#FAFAFB] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400"
            >
              <span className="tnum text-[24px] leading-tight font-bold text-ink">{s.count}</span>
              <span className="mt-1 flex items-center gap-1.5 text-[13px] text-muted group-hover:text-ink-2">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                {s.stage}
              </span>
            </button>
            {/* Chevron divider between stages */}
            {i < LIFECYCLE.length - 1 && (
              <svg
                aria-hidden="true"
                viewBox="0 0 10 64"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-y-0 -right-[5px] z-10 hidden h-full w-2.5 lg:block"
              >
                <path d="M0 0 L10 32 L0 64" fill="#FFFFFF" stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </DashCard>
  );
}
