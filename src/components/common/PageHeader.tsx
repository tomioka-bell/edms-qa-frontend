import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Rendered to the left of the actions — e.g. the current date. */
  meta?: ReactNode;
}

/**
 * Page heading block. No card, no shadow — hierarchy comes from the eyebrow,
 * the title weight, and the rule that closes the block.
 */
export default function PageHeader({ eyebrow, title, description, actions, meta }: Props) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.022em] sm:text-[30px]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>

      {(meta || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end lg:pt-1">
          {meta}
          {actions}
        </div>
      )}
    </header>
  );
}
