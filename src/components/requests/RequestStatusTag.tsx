import type { RequestStatus } from '../../types/documentRequest';
import type { TemplateType } from '../../types/documentTemplate';
import { REQUEST_STATUS_LABEL } from '../../lib/documentRequests';
import { cn } from '../../lib/cn';

const STATUS: Record<RequestStatus, { cls: string; dot: string }> = {
  DRAFT: { cls: 'bg-[#F4F4F5] text-ink-2 ring-[#E4E4E7]', dot: 'bg-faint' },
  IN_PROGRESS: { cls: 'bg-info-soft text-info ring-[#BFDBFE]', dot: 'bg-info' },
  WITH_SUPPLIER: { cls: 'bg-[#F5F3FF] text-[#6D28D9] ring-[#DDD6FE]', dot: 'bg-[#7C3AED]' },
  APPROVED: { cls: 'bg-ok-soft text-[#15803D] ring-[#BBF7D0]', dot: 'bg-ok' },
  RETURNED: { cls: 'bg-warn-soft text-[#A16207] ring-[#FEF08A]', dot: 'bg-warn' },
  CANCELLED: { cls: 'bg-danger-soft text-danger-strong ring-danger-ring', dot: 'bg-danger' },
};

/** Where a request is in its life, as a small coloured tag. */
export default function RequestStatusTag({ status }: { status: RequestStatus }) {
  const tone = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset', tone.cls)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden />
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

/** Whether the document runs a preset flow or is an ordinary one. */
export function DocTypeTag({ type }: { type: TemplateType }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] whitespace-nowrap uppercase',
        type === 'FLOW' ? 'bg-brand-50 text-brand-700' : 'bg-[#F4F4F5] text-ink-2',
      )}
    >
      {type === 'FLOW' ? 'Flow' : 'Normal'}
    </span>
  );
}
