import { cn } from '../../lib/cn';

/** PSTH mark — "PS" monogram on the blue brand tile. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-lg bg-brand-500 font-bold tracking-[-0.02em] text-white shadow-[0_2px_8px_rgb(31_74_143/0.3)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      PS
    </div>
  );
}

export function LogoLockup({ size = 36 }: { size?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LogoMark size={size} />
      <div className="min-w-0 leading-none">
        <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">PSTH EDMS</p>
        <p className="mt-1 truncate text-[11px] text-muted">Document Management System</p>
      </div>
    </div>
  );
}
