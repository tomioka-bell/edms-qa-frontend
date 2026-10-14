import type { DocCategory, Department } from '../../types/document';
import { cn } from '../../lib/cn';

/** Neutral chip for taxonomy values — no colour, so status stays the only signal. */
export function CategoryTag({ value, className }: { value: DocCategory; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] border border-line bg-[#FAFAFB] px-1.5 py-0.5 text-xs font-medium text-ink-2 whitespace-nowrap',
        className,
      )}
    >
      {value}
    </span>
  );
}

export function DepartmentTag({ value }: { value: Department }) {
  return <span className="text-[13px] text-ink-2">{value}</span>;
}
