import type { ReactNode } from 'react';
import { FileSearch } from 'lucide-react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export default function EmptyState({ icon, title, description, action, compact }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-6 py-12' : 'px-6 py-20'}`}
    >
      <div className="flex size-11 items-center justify-center rounded-lg border border-line bg-[#FAFAFB] text-faint">
        {icon ?? <FileSearch size={19} strokeWidth={1.75} />}
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
