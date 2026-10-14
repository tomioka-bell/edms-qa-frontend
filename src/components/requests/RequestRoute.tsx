import { Check, CircleDashed, Clock3, MousePointerClick, X } from 'lucide-react';
import type { DocumentRequestStep, RequestApprover } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { DUE_TONE, describeDue, describeLimit } from '../../lib/deadlines';

const STEP_TONE = {
  WAITING: { ring: 'bg-[#F4F4F5] text-muted', label: 'Waiting', text: 'text-muted' },
  ACTIVE: { ring: 'bg-brand-500 text-white', label: 'Deciding now', text: 'text-brand-600' },
  APPROVED: { ring: 'bg-ok text-white', label: 'Passed', text: 'text-[#15803D]' },
  REJECTED: { ring: 'bg-danger text-white', label: 'Sent back', text: 'text-danger-strong' },
} as const;

function Decision({ approver, live }: { approver: RequestApprover; live: boolean }) {
  if (approver.decision === 'APPROVED') {
    return (
      <span className="flex items-center gap-1 text-[11.5px] font-medium text-[#15803D]">
        <Check size={12} strokeWidth={2.6} />
        Approved{approver.decided_at ? ` · ${dayjs(approver.decided_at).format('DD MMM YYYY HH:mm')}` : ''}
      </span>
    );
  }
  if (approver.decision === 'REJECTED') {
    return (
      <span className="flex items-center gap-1 text-[11.5px] font-medium text-danger-strong">
        <X size={12} strokeWidth={2.6} />
        Sent back{approver.decided_at ? ` · ${dayjs(approver.decided_at).format('DD MMM YYYY HH:mm')}` : ''}
      </span>
    );
  }
  return live ? (
    <span className="flex items-center gap-1 text-[11.5px] font-medium text-brand-600">
      <Clock3 size={12} />
      Waiting for their decision
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11.5px] text-faint">
      <CircleDashed size={12} />
      Not yet
    </span>
  );
}

/** A step's time limit: how long is left while it is being decided, otherwise how long it allows. */
function StepClock({ step, live }: { step: DocumentRequestStep; live: boolean }) {
  if (live && step.status === 'ACTIVE' && step.due_at) {
    const due = describeDue(step.due_at);
    return (
      <span
        className={cn('tnum inline-flex items-center gap-1 rounded px-1.5 py-px text-[10.5px] font-semibold ring-1 ring-inset', DUE_TONE[due.tone])}
        title={`Due ${dayjs(step.due_at).format('DD MMM YYYY HH:mm')}`}
      >
        <Clock3 size={10} />
        {due.text}
      </span>
    );
  }
  // Not started (or already decided): only worth saying while it still lies ahead
  if (step.due_days > 0 && (!live || step.status === 'WAITING')) {
    return <span className="tnum text-[11.5px] text-muted">{describeLimit(step.due_days)}</span>;
  }
  return null;
}

/**
 * A request's approval route with how far it has got: each step, its people, and what each of
 * them decided. `live` is false for a request that has not been sent, so nothing reads as waiting.
 */
export default function RequestRoute({ steps, live = true }: { steps: DocumentRequestStep[]; live?: boolean }) {
  if (steps.length === 0) {
    return <p className="text-[12.5px] text-faint italic">No approval route yet</p>;
  }
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const tone = STEP_TONE[live ? step.status : 'WAITING'];
        return (
          <li key={step.step_no} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className="absolute top-7 bottom-0 left-3 w-px bg-line" aria-hidden />}
            <span className={cn('tnum relative flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', tone.ring)}>
              {live && step.status === 'APPROVED' ? <Check size={13} strokeWidth={3} /> : live && step.status === 'REJECTED' ? <X size={13} strokeWidth={3} /> : step.step_no}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-semibold text-ink">{step.step_name}</span>
                {live && <span className={cn('text-[11.5px] font-medium', tone.text)}>{tone.label}</span>}
                {step.approvers.length > 1 && (
                  <span className="rounded bg-[#F4F4F5] px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] text-ink-2 uppercase">
                    {step.approval_rule === 'ALL' ? 'All must approve' : 'Any one'}
                  </span>
                )}
                <StepClock step={step} live={live} />
              </p>
              {step.approvers.length === 0 ? (
                <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#A16207]">
                  <MousePointerClick size={13} />
                  No approver chosen yet
                </p>
              ) : (
                <ul className="mt-1.5 flex flex-col gap-2">
                  {step.approvers.map((a) => (
                    <li key={a.user_id} className="min-w-0">
                      <p className="truncate text-[12.5px] text-ink-2">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted">{[a.position, a.department_code].filter(Boolean).length > 0 ? ` · ${[a.position, a.department_code].filter(Boolean).join(' · ')}` : ''}</span>
                      </p>
                      <Decision approver={a} live={live && step.status !== 'WAITING'} />
                      {a.comment && (
                        <p className="mt-1 rounded-md border border-line bg-[#FAFAFB] px-2.5 py-1.5 text-[12px] leading-relaxed text-ink-2">“{a.comment}”</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
