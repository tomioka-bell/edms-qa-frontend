import { Link } from 'react-router-dom';
import { ACKNOWLEDGEMENT_COMPLETION, PENDING_TASKS } from '../../data/mockDashboard';
import type { TaskTone } from '../../data/mockDashboard';
import { cn } from '../../lib/cn';
import DashCard from './DashCard';

const TONE: Record<TaskTone, string> = {
  blue: 'bg-[#EEF2FF] text-[#4169E1]',
  green: 'bg-[#ECF8F0] text-[#2F8F4E]',
  violet: 'bg-[#F3EEFF] text-[#7C3AED]',
  orange: 'bg-[#FFF3EA] text-[#D9580F]',
};

export default function PendingTasks() {
  return (
    <DashCard title="My pending tasks" action={{ label: 'View all', to: '/tasks' }} bodyClassName="px-5 pt-1 pb-5">
      <ul>
        {PENDING_TASKS.map((t) => (
          <li key={t.id} className="border-b border-line-soft last:border-b-0">
            <Link
              to={t.to}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 text-ink! transition-colors hover:bg-[#FAFAFB]"
            >
              <span
                className={cn('tnum flex size-8 shrink-0 items-center justify-center rounded-lg text-[12.5px] font-bold', TONE[t.tone])}
              >
                {t.count}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{t.label}</span>
              {t.count > 0 ? (
                <span className="shrink-0 rounded-full bg-[#FFF3EA] px-2.5 py-0.5 text-[12px] font-medium text-[#C2410C]">
                  Action needed
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-[#F1F1F4] px-2.5 py-0.5 text-[12px] font-medium text-ink-2">
                  Clear
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-line pt-3.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-2">Acknowledgement completion</span>
          <span className="tnum font-semibold text-ink">{ACKNOWLEDGEMENT_COMPLETION}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Acknowledgement completion"
          aria-valuenow={ACKNOWLEDGEMENT_COMPLETION}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2 rounded-full bg-[#EDEEF2]"
        >
          <div className="h-full rounded-full bg-[#4169E1]" style={{ width: `${ACKNOWLEDGEMENT_COMPLETION}%` }} />
        </div>
      </div>
    </DashCard>
  );
}
