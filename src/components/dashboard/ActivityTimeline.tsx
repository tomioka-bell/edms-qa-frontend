import {
  Archive,
  CheckCheck,
  FileCheck2,
  GitBranch,
  Send,
  Undo2,
  Eye,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mockActivities } from '../../data/mockActivities';
import type { ActivityKind } from '../../types/document';
import { fmtRelative, dayjs } from '../../lib/format';

const KIND: Record<ActivityKind, { icon: LucideIcon; cls: string }> = {
  submitted: { icon: Send, cls: 'text-brand-500 bg-brand-50 ring-brand-100' },
  published: { icon: FileCheck2, cls: 'text-ok bg-ok-soft ring-[#DCFCE7]' },
  approved: { icon: CheckCheck, cls: 'text-ok bg-ok-soft ring-[#DCFCE7]' },
  'review-requested': { icon: Eye, cls: 'text-warn bg-warn-soft ring-[#FEF9C3]' },
  'revision-created': { icon: GitBranch, cls: 'text-muted bg-[#F4F4F5] ring-[#E4E4E7]' },
  archived: { icon: Archive, cls: 'text-muted bg-[#F4F4F5] ring-[#E4E4E7]' },
  rejected: { icon: Undo2, cls: 'text-danger-strong bg-danger-soft ring-danger-ring' },
};

export default function ActivityTimeline() {
  return (
    <section className="panel flex h-fit flex-col">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Recent Activity</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Document control audit trail</p>
        </div>
      </div>

      <ol className="px-5 py-4">
        {mockActivities.map((a, i) => {
          const { icon: Icon, cls } = KIND[a.kind];
          const isLast = i === mockActivities.length - 1;
          return (
            <li key={a.id} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* Connector */}
              {!isLast && (
                <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />
              )}
              <span
                className={`relative z-10 mt-0.5 flex size-[27px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${cls}`}
              >
                <Icon size={13} strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] leading-snug text-ink-2">
                  <span className="doc-code text-ink">{a.docCode}</span>{' '}
                  <span className="text-ink-2">{a.message}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-faint">
                  <span className="font-medium text-muted">{a.actor}</span>
                  <span>·</span>
                  <span title={dayjs(a.timestamp).format('DD MMM YYYY HH:mm')}>
                    {fmtRelative(a.timestamp)}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-line px-5 py-3">
        <button
          type="button"
          className="text-[12.5px] font-medium text-ink-2 transition-colors hover:text-brand-600"
        >
          View complete audit trail
        </button>
      </div>
    </section>
  );
}
