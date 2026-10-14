import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

interface Props {
  title: string;
  /** Right side of the header: a "View all" link, or a quiet note. */
  action?: { label: string; to: string } | { note: string };
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Dashboard panel: titled header rule, then content. */
export default function DashCard({ title, action, className, bodyClassName, children }: Props) {
  return (
    <section className={cn('flex flex-col rounded-xl border border-line bg-surface', className)}>
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {action &&
          ('to' in action ? (
            <Link
              to={action.to}
              className="shrink-0 text-[13px] font-medium text-brand-500! transition-colors hover:text-brand-700! hover:underline"
            >
              {action.label}
            </Link>
          ) : (
            <span className="shrink-0 text-[12.5px] text-muted">{action.note}</span>
          ))}
      </header>
      <div className={cn('flex-1 p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
