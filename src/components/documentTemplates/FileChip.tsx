import { cn } from '../../lib/cn';

const TONES: Record<string, { label: string; cls: string }> = {
  pdf: { label: 'PDF', cls: 'bg-danger-soft text-danger-strong ring-danger-ring' },
  doc: { label: 'DOC', cls: 'bg-info-soft text-info ring-[#BFDBFE]' },
  docx: { label: 'DOC', cls: 'bg-info-soft text-info ring-[#BFDBFE]' },
  xls: { label: 'XLS', cls: 'bg-ok-soft text-[#15803D] ring-[#BBF7D0]' },
  xlsx: { label: 'XLS', cls: 'bg-ok-soft text-[#15803D] ring-[#BBF7D0]' },
};

/** Compact file-format chip for any extension a document template accepts. */
export default function FileChip({ extension, size = 'md' }: { extension: string; size?: 'sm' | 'md' }) {
  const tone = TONES[extension] ?? { label: extension.slice(0, 4).toUpperCase() || 'FILE', cls: 'bg-[#F4F4F5] text-ink-2 ring-[#E4E4E7]' };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-bold tracking-wide ring-1 ring-inset',
        size === 'sm' ? 'h-6 w-8 text-[9.5px]' : 'h-9 w-9 text-[10px]',
        tone.cls,
      )}
      aria-hidden
    >
      {tone.label}
    </span>
  );
}
