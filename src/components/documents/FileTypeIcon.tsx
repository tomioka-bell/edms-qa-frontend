import { cn } from '../../lib/cn';

const MAP = {
  pdf: { label: 'PDF', cls: 'bg-danger-soft text-danger-strong ring-danger-ring' },
  docx: { label: 'DOC', cls: 'bg-info-soft text-info ring-[#BFDBFE]' },
  xlsx: { label: 'XLS', cls: 'bg-ok-soft text-[#15803D] ring-[#BBF7D0]' },
} as const;

/** Compact file-format chip — reads faster than a generic paperclip icon. */
export default function FileTypeIcon({
  type,
  size = 'md',
}: {
  type: 'pdf' | 'docx' | 'xlsx';
  size?: 'sm' | 'md';
}) {
  const m = MAP[type];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-bold tracking-wide ring-1 ring-inset',
        size === 'sm' ? 'h-6 w-8 text-[9.5px]' : 'h-10 w-10 text-[10.5px]',
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
