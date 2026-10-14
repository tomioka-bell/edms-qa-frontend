import { Drawer, Tabs, Tooltip, App as AntApp } from 'antd';
import {
  Download,
  Eye,
  GitBranch,
  Pencil,
  X,
  Building2,
  UserRound,
  CalendarDays,
  CalendarClock,
  FileClock,
  Tag,
  Hash,
  RotateCcw,
} from 'lucide-react';
import type { QaDocument } from '../../types/document';
import StatusBadge from '../common/StatusBadge';
import ApprovalTimeline from './ApprovalTimeline';
import FileTypeIcon from './FileTypeIcon';
import { fmtDate, revLabel, daysUntil } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Props {
  doc: QaDocument | null;
  open: boolean;
  onClose: () => void;
  onCreateRevision: (doc: QaDocument) => void;
}

/** Label/value row used throughout the information grid. */
function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
        <Icon size={12.5} strokeWidth={1.9} className="text-faint" />
        {label}
      </span>
      <span className="text-[13.5px] font-medium text-ink">{children}</span>
    </div>
  );
}

export default function DocumentDetailDrawer({ doc, open, onClose, onCreateRevision }: Props) {
  const { message } = AntApp.useApp();

  if (!doc) return null;

  const daysToReview = daysUntil(doc.nextReviewDate);
  const reviewTone =
    daysToReview < 0 ? 'text-danger-strong' : daysToReview <= 30 ? 'text-warn' : 'text-ink';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={688}
      closable={false}
      styles={{
        body: { padding: 0, background: '#F7F8FA' },
        header: { display: 'none' },
      }}
      className="[&_.ant-drawer-body]:slim-scroll"
    >
      {/* ── Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="doc-code rounded-[5px] bg-brand-50 px-1.5 py-0.5 text-[12px] text-brand-700">
                {doc.code}
              </span>
              <StatusBadge status={doc.status} size="sm" />
              <span className="tnum rounded-[5px] border border-line bg-[#FAFAFB] px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
                {revLabel(doc.revision)}
              </span>
            </div>
            <h2 className="mt-2.5 text-[20px] leading-snug font-semibold tracking-[-0.018em]">
              {doc.name}
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              {doc.category} · {doc.department} · Owner {doc.owner}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => message.info(`Opening preview for ${doc.file.name}`)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.75 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
          >
            <Eye size={14.5} strokeWidth={2} />
            View Document
          </button>
          <button
            type="button"
            onClick={() => onCreateRevision(doc)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.75 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
          >
            <GitBranch size={14.5} strokeWidth={2} />
            Create Revision
          </button>
          <button
            type="button"
            onClick={() => message.info('Edit information form would open here.')}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.75 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
          >
            <Pencil size={14.5} strokeWidth={2} />
            Edit
          </button>
          <Tooltip title="Download controlled copy">
            <button
              type="button"
              onClick={() => message.success(`Downloading ${doc.file.name}`)}
              className="ml-auto flex size-8.5 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] hover:text-ink"
            >
              <Download size={15.5} strokeWidth={1.9} />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────── */}
      <div className="px-6 pb-8">
        <Tabs
          defaultActiveKey="details"
          items={[
            {
              key: 'details',
              label: 'Details',
              children: (
                <div className="flex flex-col gap-5 pb-2">
                  {/* Document information */}
                  <section className="panel overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                      <h3 className="text-[13px] font-semibold">Document Information</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
                      <div className="bg-surface">
                        <Field icon={Hash} label="Document Code">
                          <span className="doc-code text-[12.5px]">{doc.code}</span>
                        </Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={Tag} label="Category">{doc.category}</Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={Building2} label="Department">{doc.department}</Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={UserRound} label="Owner">{doc.owner}</Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={GitBranch} label="Current Revision">
                          <span className="tnum">{revLabel(doc.revision)}</span>
                        </Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={RotateCcw} label="Review Cycle">{doc.reviewCycle}</Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={CalendarDays} label="Effective Date">
                          <span className="tnum">{fmtDate(doc.effectiveDate)}</span>
                        </Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={CalendarClock} label="Next Review Date">
                          <span className={cn('tnum', reviewTone)}>{fmtDate(doc.nextReviewDate)}</span>
                        </Field>
                      </div>
                      <div className="bg-surface">
                        <Field icon={FileClock} label="Created Date">
                          <span className="tnum">{fmtDate(doc.createdDate)}</span>
                        </Field>
                      </div>
                    </div>

                    {/* Review countdown strip */}
                    <div className="flex items-center gap-2 border-t border-line bg-[#FAFAFB] px-4 py-2.5">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          daysToReview < 0 ? 'bg-danger' : daysToReview <= 30 ? 'bg-warn' : 'bg-ok',
                        )}
                      />
                      <p className="text-[12px] text-muted">
                        {daysToReview < 0
                          ? `Review overdue by ${Math.abs(daysToReview)} days.`
                          : `Next review in ${daysToReview} days.`}{' '}
                        Cycle: {doc.reviewCycle}.
                      </p>
                    </div>
                  </section>

                  {/* Description */}
                  <section className="panel p-4">
                    <h3 className="text-[13px] font-semibold">Description</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{doc.description}</p>
                  </section>

                  {/* Current file */}
                  <section className="panel overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                      <h3 className="text-[13px] font-semibold">Current File</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <FileTypeIcon type={doc.file.type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{doc.file.name}</p>
                        <p className="tnum mt-0.5 text-[12px] text-muted">
                          {doc.file.size} · Uploaded {fmtDate(doc.file.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => message.info(`Previewing ${doc.file.name}`)}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
                        >
                          <Eye size={13.5} />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => message.success(`Downloading ${doc.file.name}`)}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
                        >
                          <Download size={13.5} />
                          Download
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Approval flow */}
                  <section className="panel overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                      <h3 className="text-[13px] font-semibold">Approval Flow</h3>
                    </div>
                    <div className="p-4">
                      <ApprovalTimeline steps={doc.approvals} />
                    </div>
                  </section>
                </div>
              ),
            },
            {
              key: 'revisions',
              label: `Revision History (${doc.revisions.length})`,
              children: (
                <section className="panel overflow-hidden">
                  <ol className="divide-y divide-line-soft">
                    {doc.revisions.map((r, i) => (
                      <li key={r.revision} className="flex gap-4 px-4 py-3.5">
                        <div className="flex w-19.5 shrink-0 flex-col items-start">
                          <span
                            className={cn(
                              'tnum rounded-[5px] px-1.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset',
                              i === 0
                                ? 'bg-brand-50 text-brand-700 ring-brand-200'
                                : 'bg-[#F4F4F5] text-muted ring-[#E4E4E7]',
                            )}
                          >
                            {revLabel(r.revision)}
                          </span>
                          {i === 0 && (
                            <span className="mt-1.5 text-[10.5px] font-medium text-ok">Current</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] leading-snug font-medium text-ink">{r.summary}</p>
                          <p className="tnum mt-1 text-[12px] text-muted">
                            {fmtDate(r.date)}
                            {r.author && <span className="text-faint"> · {r.author}</span>}
                          </p>
                        </div>
                        <Tooltip title={`Download ${revLabel(r.revision)}`}>
                          <button
                            type="button"
                            onClick={() => message.success(`Downloading ${doc.code} ${revLabel(r.revision)}`)}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-[#F4F4F5] hover:text-ink"
                          >
                            <Download size={14.5} strokeWidth={1.9} />
                          </button>
                        </Tooltip>
                      </li>
                    ))}
                  </ol>
                </section>
              ),
            },
          ]}
        />
      </div>
    </Drawer>
  );
}
