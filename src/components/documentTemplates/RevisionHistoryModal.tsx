import { useEffect, useState } from 'react';
import { Alert, Modal, Spin } from 'antd';
import { X } from 'lucide-react';
import { documentTemplateFileUrl, formatFileSize, listDocumentTemplateRevisions, revisionLabel } from '../../lib/documentTemplates';
import type { DocumentTemplate, DocumentTemplateRevision, RevisionStatus } from '../../types/documentTemplate';
import FileChip from './FileChip';
import { cn } from '../../lib/cn';
import { dayjs } from '../../lib/format';

interface Props {
  /** Document whose revisions to show; null keeps the dialog closed. */
  template: DocumentTemplate | null;
  onClose: () => void;
}

const STATUS: Record<RevisionStatus, { label: string; cls: string }> = {
  CURRENT: { label: 'In force', cls: 'bg-ok-soft text-[#15803D] ring-[#BBF7D0]' },
  DRAFT: { label: 'Draft', cls: 'bg-warn-soft text-[#A16207] ring-[#FEF08A]' },
  SUPERSEDED: { label: 'Earlier', cls: 'bg-[#F4F4F5] text-muted ring-[#E4E4E7]' },
};

/** One thing that differs between a revision and the one before it. */
interface Change {
  field: string;
  from: string;
  to: string;
}

/** What a revision changed in the document's details and files, compared with the previous revision. */
function changesFrom(previous: DocumentTemplateRevision, revision: DocumentTemplateRevision): Change[] {
  const changes: Change[] = [];
  const compare = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from: from || '(empty)', to: to || '(empty)' });
  };
  compare('Code', previous.code, revision.code);
  compare('Name', previous.name, revision.name);
  compare('Category', previous.category_name, revision.category_name);
  compare('Department', previous.department_code, revision.department_code);
  compare('Description', previous.description, revision.description);
  const typeName = (r: DocumentTemplateRevision) => (r.template_type === 'FLOW' ? 'Runs an approval flow' : 'Normal document');
  compare('Type', typeName(previous), typeName(revision));
  compare('Approval template', previous.approval_template_code, revision.approval_template_code);
  // Blocks are compared as a layout, not one by one: what matters is that it changed
  const layout = (r: DocumentTemplateRevision) =>
    r.sign_blocks
      .map((b) => [b.signer_kind, b.step_no, b.page_no, b.x.toFixed(3), b.y.toFixed(3), b.width.toFixed(3), b.height.toFixed(3)].join('|'))
      .sort()
      .join(';');
  if (layout(previous) !== layout(revision)) {
    const count = (r: DocumentTemplateRevision) => `${r.sign_blocks.length} ${r.sign_blocks.length === 1 ? 'block' : 'blocks'}`;
    changes.push({ field: 'Signature blocks', from: count(previous), to: `${count(revision)}, rearranged` });
  }

  const carried = new Set(revision.files.map((f) => f.source_file_id));
  for (const old of previous.files) {
    if (!carried.has(old.file_id)) changes.push({ field: 'File removed', from: old.label || old.original_name, to: '' });
  }
  for (const file of revision.files) {
    const source = previous.files.find((f) => f.file_id === file.source_file_id);
    if (source && source.label !== file.label) {
      changes.push({ field: `Label of ${file.original_name}`, from: source.label || '(none)', to: file.label || '(none)' });
    }
  }
  return changes;
}

/** Every revision of a document, newest first, with what changed and the files of that version. */
export default function RevisionHistoryModal({ template, onClose }: Props) {
  return (
    <Modal
      open={template !== null}
      onCancel={onClose}
      width={680}
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog, so every opening loads the current history */}
      {template && <History template={template} onClose={onClose} />}
    </Modal>
  );
}

function History({ template, onClose }: { template: DocumentTemplate; onClose: () => void }) {
  const [revisions, setRevisions] = useState<DocumentTemplateRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDocumentTemplateRevisions(template.document_template_id)
      .then((list) => {
        if (!cancelled) setRevisions(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the revisions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template.document_template_id]);

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow">Revision History</p>
          <h2 className="mt-1.5 truncate text-[19px] font-semibold tracking-[-0.018em]">{template.name}</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            <span className="doc-code text-brand-600">{template.code}</span> · every version of this document, newest first, with the values and files it had
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

      <div className="slim-scroll max-h-[min(64vh,620px)] overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="grid h-40 place-items-center">
            <Spin />
          </div>
        ) : error ? (
          <Alert type="warning" showIcon title="The revisions could not be loaded" description={error} />
        ) : (
          <ol className="flex flex-col" aria-label="Revisions">
            {revisions.map((revision, i) => {
              const status = STATUS[revision.status];
              // The list is newest first, so the revision before this one is the next item
              const previous = revisions[i + 1];
              const changes = previous ? changesFrom(previous, revision) : [];
              return (
                <li key={revision.revision_id} className="relative flex gap-3.5 pb-6 last:pb-0">
                  {/* Line down to the previous revision */}
                  {i < revisions.length - 1 && <span className="absolute top-7.5 bottom-0 left-5.25 w-px bg-line" aria-hidden />}
                  <span
                    className={cn(
                      'tnum relative flex h-7 w-11 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
                      revision.status === 'CURRENT' ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-ink-2',
                    )}
                  >
                    {revisionLabel(revision.revision_no).replace('Rev.', 'R')}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[14px] font-semibold text-ink">{revisionLabel(revision.revision_no)}</span>
                      <span className={cn('rounded-md px-1.5 py-px text-[11px] font-medium ring-1 ring-inset', status.cls)}>{status.label}</span>
                    </p>
                    <p className="tnum mt-0.5 text-[12px] text-muted">
                      {revision.published_at
                        ? `Published ${dayjs(revision.published_at).format('DD MMM YYYY')} by ${revision.published_by}`
                        : `Started ${dayjs(revision.created_at).format('DD MMM YYYY')} by ${revision.created_by} · not published`}
                      {revision.effective_date && ` · effective ${dayjs(revision.effective_date).format('DD MMM YYYY')}`}
                    </p>
                    <p className={cn('mt-1.5 text-[13px] leading-relaxed', revision.change_summary ? 'text-ink-2' : 'text-faint italic')}>
                      {revision.change_summary || (revision.revision_no === 1 ? 'First revision.' : 'No change note.')}
                    </p>

                    {/* The document as it read in this revision */}
                    <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-[#FAFAFB] px-3 py-2.5 text-[12.5px]">
                      <dt className="text-muted">Code</dt>
                      <dd className="doc-code text-ink-2">{revision.code}</dd>
                      <dt className="text-muted">Name</dt>
                      <dd className="min-w-0 wrap-break-word text-ink-2">{revision.name}</dd>
                      <dt className="text-muted">Category</dt>
                      <dd className="text-ink-2">{revision.category_name || '—'}</dd>
                      <dt className="text-muted">Department</dt>
                      <dd className="text-ink-2">{revision.department_code || '—'}</dd>
                      {revision.template_type === 'FLOW' && (
                        <>
                          <dt className="text-muted">Approval flow</dt>
                            <dd className="min-w-0 wrap-break-word text-ink-2">
                              <span className="doc-code">{revision.approval_template_code}</span> · {revision.approval_template_name} ·{' '}
                            {revision.sign_blocks.length} {revision.sign_blocks.length === 1 ? 'signature block' : 'signature blocks'}
                          </dd>
                        </>
                      )}
                      {revision.description && (
                        <>
                          <dt className="text-muted">Description</dt>
                          <dd className="min-w-0 wrap-break-word text-ink-2">{revision.description}</dd>
                        </>
                      )}
                    </dl>

                    {changes.length > 0 && (
                      <div className="mt-2.5">
                        <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">
                          Changed from {revisionLabel(previous.revision_no)}
                        </p>
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {changes.map((change) => (
                            <li key={`${change.field}-${change.from}`} className="text-[12.5px] leading-relaxed text-ink-2">
                              <span className="font-medium text-ink">{change.field}:</span>{' '}
                              <span className="text-muted line-through decoration-[#D4D4D8]">{change.from}</span>
                              {change.to && (
                                <>
                                  <span className="text-faint"> → </span>
                                  <span>{change.to}</span>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {revision.files.length === 0 ? (
                      <p className="mt-2 text-[12.5px] text-faint italic">No files</p>
                    ) : (
                      <ul className="mt-2.5 flex flex-col gap-1.5">
                        {revision.files.map((file) => (
                          <li key={file.file_id}>
                            <a
                              href={documentTemplateFileUrl(template.document_template_id, file.file_id)}
                              title={`Download ${file.original_name}`}
                              className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                            >
                              <FileChip extension={file.extension} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-medium text-ink-2 group-hover:text-brand-600">
                                  {file.label || file.original_name}
                                </span>
                                <span className="tnum block truncate text-[11px] text-faint">
                                  {file.label ? `${file.original_name} · ` : ''}
                                  {formatFileSize(file.size_bytes)}
                                </span>
                              </span>
                              {/* Tells a file that came in with this revision from one carried over unchanged */}
                              {revision.revision_no > 1 && (
                                <span
                                  className={cn(
                                    'shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] uppercase',
                                    file.source_file_id === null ? 'bg-brand-50 text-brand-700' : 'text-faint',
                                  )}
                                >
                                  {file.source_file_id === null ? 'New' : 'Unchanged'}
                                </span>
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex justify-end border-t border-line bg-[#FAFAFB] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Done
        </button>
      </div>
    </>
  );
}
