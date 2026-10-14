import type { DocStatus } from '../../types/document';
import { cn } from '../../lib/cn';

type Tone = {
  dot: string;
  text: string;
  bg: string;
  ring: string;
};

const TONES: Record<DocStatus, Tone> = {
  Active: { dot: 'bg-ok', text: 'text-[#15803D]', bg: 'bg-ok-soft', ring: 'ring-[#BBF7D0]' },
  'Under Review': { dot: 'bg-warn', text: 'text-[#A16207]', bg: 'bg-warn-soft', ring: 'ring-[#FEF08A]' },
  'Pending Approval': { dot: 'bg-brand-500', text: 'text-brand-700', bg: 'bg-brand-50', ring: 'ring-brand-200' },
  'Expiring Soon': { dot: 'bg-warn', text: 'text-[#A16207]', bg: 'bg-warn-soft', ring: 'ring-[#FEF08A]' },
  Expired: { dot: 'bg-danger', text: 'text-danger-strong', bg: 'bg-danger-soft', ring: 'ring-danger-ring' },
  Draft: { dot: 'bg-faint', text: 'text-ink-2', bg: 'bg-[#F4F4F5]', ring: 'ring-[#E4E4E7]' },
  Archived: { dot: 'bg-[#D4D4D8]', text: 'text-muted', bg: 'bg-[#FAFAFB]', ring: 'ring-line' },
};

interface Props {
  status: DocStatus;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Status pill. Kept deliberately quiet — a 5px dot carries the colour so a
 * dense table of badges never turns into confetti.
 */
export default function StatusBadge({ status, size = 'md', className }: Props) {
  const t = TONES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.75 text-xs',
        t.bg,
        t.text,
        t.ring,
        className,
      )}
    >
        <span className={cn('size-1.25 shrink-0 rounded-full', t.dot)} />
        {status}
    </span>
  );
}
