import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spin } from 'antd';
import { LayoutGrid, ShieldAlert } from 'lucide-react';
import { useIsAdmin } from '../../stores/access';

/** Shows a page to administrators only; anyone else is told so, and how to get in. */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();

  if (isAdmin) return children;
  if (isAdmin === null) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spin />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="anim-rise panel grid min-h-[min(60vh,520px)] place-items-center px-6 py-14">
        <div className="flex max-w-md flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-warn-soft text-[#A16207] ring-1 ring-[#FDE68A]">
            <ShieldAlert size={22} strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">For administrators only</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            This page is where the templates, suppliers and settings everyone uses are maintained. Ask an administrator of QA Documentation if you need
            to work here.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
          >
            <LayoutGrid size={14} />
            Go to the dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
