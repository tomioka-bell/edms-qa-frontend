import { Tooltip } from 'antd';
import { Clock3, MousePointerClick } from 'lucide-react';
import type { ApprovalTemplateStep, StepApprover } from '../../types/approval';
import { cn } from '../../lib/cn';

// Names shown in full before the rest collapse into "+N"
const VISIBLE_PEOPLE = 2;

// Soft, distinguishable tints for initials; picked by user id so a person keeps their colour everywhere
const AVATAR_TINTS = [
  'bg-brand-100 text-brand-700',
  'bg-[#DCFCE7] text-[#166534]',
  'bg-[#FEF3C7] text-[#92400E]',
  'bg-[#FCE7F3] text-[#9D174D]',
  'bg-[#E0E7FF] text-[#3730A3]',
  'bg-[#CCFBF1] text-[#115E59]',
];

/** "Anan K. (Mock)" -> "AK"; falls back to the first letter for one-word names. */
function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0]?.[0] ?? '?');
  return letters.toUpperCase();
}

function PersonDetails({ people }: { people: StepApprover[] }) {
  return (
    <ul className="flex flex-col gap-1.5 py-0.5">
      {people.map((p) => (
        <li key={p.user_id} className="leading-tight">
          <span className="block text-[12.5px] font-medium">{p.name}</span>
          <span className="block text-[11px] opacity-70">
            {[p.position, p.department_code, p.employee_code].filter(Boolean).join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Small label saying how a step with several people passes. */
function RulePill({ all }: { all: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] whitespace-nowrap uppercase ring-1 ring-inset',
        all ? 'bg-warn-soft text-[#A16207] ring-[#FEF08A]' : 'bg-info-soft text-info ring-[#BFDBFE]',
      )}
    >
      {all ? 'All must act' : 'Any one'}
    </span>
  );
}

function People({ step }: { step: ApprovalTemplateStep }) {
  if (step.approver_type === 'REQUESTER_SELECT') {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted italic">
          <MousePointerClick size={13} className="shrink-0 text-faint" aria-hidden />
          Chosen when submitting
        </span>
        {step.approval_rule === 'ALL' && <RulePill all />}
      </span>
    );
  }

  const people = step.approvers;
  const shown = people.slice(0, VISIBLE_PEOPLE);
  const hidden = people.length - shown.length;

  return (
    <Tooltip title={<PersonDetails people={people} />} placement="topLeft">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {/* Overlapping initials: one glance tells one person from several */}
        <span className="flex shrink-0 items-center" aria-hidden>
          {shown.map((p, i) => (
            <span
              key={p.user_id}
              className={cn(
                'flex size-[22px] items-center justify-center rounded-full text-[9.5px] font-semibold ring-2 ring-surface',
                AVATAR_TINTS[p.user_id % AVATAR_TINTS.length],
                i > 0 && '-ml-1',
              )}
            >
              {initials(p.name)}
            </span>
          ))}
          {hidden > 0 && (
            <span className="tnum -ml-1 flex size-[22px] items-center justify-center rounded-full bg-[#F4F4F5] text-[9.5px] font-semibold text-ink-2 ring-2 ring-surface">
              +{hidden}
            </span>
          )}
        </span>
        <span className="min-w-0 text-[12.5px] text-ink-2">
          {shown.map((p) => p.name).join(', ')}
          {hidden > 0 && <span className="text-muted"> +{hidden} more</span>}
        </span>
        {people.length > 1 && <RulePill all={step.approval_rule === 'ALL'} />}
      </span>
    </Tooltip>
  );
}

/**
 * A template's steps as a short vertical timeline, one line per step:
 * number, what is done, who does it. Reads top to bottom, the order approvals happen in.
 */
export default function ApprovalRoute({ steps }: { steps: ApprovalTemplateStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.step_id} className="relative flex items-start gap-2.5 pb-2 last:pb-0">
          {/* Line joining this step's number to the next one */}
          {i < steps.length - 1 && <span className="absolute top-[22px] bottom-0 left-[9.5px] w-px bg-line" aria-hidden />}
          <span className="tnum relative mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10.5px] font-semibold text-white">
            {step.step_no}
          </span>
          <span className="grid min-w-0 flex-1 grid-cols-1 items-start gap-x-3 gap-y-0.5 sm:grid-cols-[104px_1fr]">
            <span className="truncate pt-px text-[12.5px] font-semibold text-ink" title={step.step_name}>
              {step.step_name}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <People step={step} />
              {step.due_days > 0 && (
                <span className="tnum flex shrink-0 items-center gap-1 text-[11.5px] text-muted" title="Time the approvers have to decide">
                  <Clock3 size={12} className="text-faint" aria-hidden />
                  {step.due_days} {step.due_days === 1 ? 'day' : 'days'}
                </span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
