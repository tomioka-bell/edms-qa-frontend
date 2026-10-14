import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileQuestion, LayoutGrid } from 'lucide-react';

/** Shown inside the app shell for any address that is not a page of QA Documentation. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="anim-rise panel grid min-h-[min(60vh,520px)] place-items-center px-6 py-14">
        <div className="flex max-w-md flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <FileQuestion size={22} strokeWidth={1.75} />
          </span>
          <p className="tnum mt-5 text-[13px] font-semibold tracking-[0.12em] text-brand-600">404</p>
          <h1 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">Page not found</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            There is no page at this address. The link may be out of date, or the address may have been mistyped.
          </p>
          <p
            className="tnum mt-3 max-w-full truncate rounded-md border border-line bg-[#FAFAFB] px-2.5 py-1 text-[12px] text-ink-2"
            title={`/qa${pathname}`}
          >
            /qa{pathname}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
            >
              <ArrowLeft size={14} />
              Go back
            </button>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
            >
              <LayoutGrid size={14} />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
