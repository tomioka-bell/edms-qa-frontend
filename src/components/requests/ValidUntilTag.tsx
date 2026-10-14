import { CalendarClock } from 'lucide-react';
import type { DocumentRequest } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { EXPIRING_SOON_DAYS, daysUntilExpiry } from '../../lib/deadlines';

/**
 * The last day a document is valid, for everyone who handles it to see: grey while it is far off,
 * amber in its last month, red once it is over. Renders nothing for a document that does not expire.
 */
export default function ValidUntilTag({ request, className }: { request: Pick<DocumentRequest, 'valid_until'>; className?: string }) {
  if (!request.valid_until) return null;
  const days = daysUntilExpiry(request.valid_until);
  const over = days < 0;
  const soon = !over && days <= EXPIRING_SOON_DAYS;
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium whitespace-nowrap ring-1 ring-inset',
        over ? 'bg-danger-soft text-danger-strong ring-danger-ring' : soon ? 'bg-warn-soft text-[#A16207] ring-[#FEF08A]' : 'bg-[#F4F4F5] text-ink-2 ring-[#E4E4E7]',
        className,
      )}
      title={over ? 'This document is past the last day it was valid' : days === 0 ? 'Today is the last day this document is valid' : `${days} ${days === 1 ? 'day' : 'days'} left`}
    >
      <CalendarClock size={11} aria-hidden />
      {over ? 'Expired' : 'Valid until'} {dayjs(request.valid_until).format('DD MMM YYYY')}
    </span>
  );
}
