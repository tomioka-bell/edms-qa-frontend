import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Input, Select, Spin } from 'antd';
import { ArrowRight, Eye, FileStack, FileUp, Workflow } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import FilePreviewModal from '../../components/documentTemplates/FilePreviewModal';
import { DocTypeTag } from '../../components/requests/RequestStatusTag';
import { ApiError } from '../../lib/api';
import { createTemplateRequest, createUploadRequest } from '../../lib/documentRequests';
import { listDocumentTemplates, revisionLabel } from '../../lib/documentTemplates';
import type { RequestSource } from '../../types/documentRequest';
import type { DocumentTemplate } from '../../types/documentTemplate';
import { cn } from '../../lib/cn';

const SOURCES: Array<{ value: RequestSource; icon: typeof FileUp; title: string; text: string }> = [
  {
    value: 'UPLOAD',
    icon: FileUp,
    title: 'Upload my own files',
    text: 'For a one-off document. You add the files and say who approves.',
  },
  {
    value: 'TEMPLATE',
    icon: FileStack,
    title: 'Start from a document template',
    text: 'Uses the files of a controlled document. A flow template also brings its approvers and signature places.',
  },
];

/** First step of sending a document for approval: where its files come from, and what it is called. */
export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const [source, setSource] = useState<RequestSource>('UPLOAD');
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateId, setTemplateId] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDocumentTemplates()
      // Only documents that have a revision in force can be used
      .then((list) => {
        if (!cancelled) setTemplates(list.filter((t) => t.is_active && t.current_revision));
      })
      .catch(() => undefined) // the picker simply stays empty; uploading still works
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const template = templates.find((t) => t.document_template_id === templateId) ?? null;

  const start = async () => {
    const name = title.trim();
    if (source === 'UPLOAD' && !name) {
      setError('Give the document a title, so approvers know what they are looking at.');
      return;
    }
    if (source === 'TEMPLATE' && !template) {
      setError('Choose the document template to start from.');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const request =
        source === 'TEMPLATE' && template
          ? await createTemplateRequest(template.document_template_id, name, description.trim())
          : await createUploadRequest(name, description.trim());
      navigate(`/documents/edit/${request.request_id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The document could not be started. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Documents" title="Create Document" description="Send a document for approval. Start by choosing where its files come from." />

      <div className="anim-rise panel mx-auto mt-6 max-w-3xl overflow-hidden">
        <div className="px-5 py-5 sm:px-6">
          <p className="text-[13px] font-semibold text-ink">Where do the files come from?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Where the files come from">
            {SOURCES.map((option) => {
              const Icon = option.icon;
              const chosen = source === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => {
                    setSource(option.value);
                    setError(null);
                  }}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                    chosen ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-400' : 'border-line bg-surface hover:border-[#D4D4D8] hover:bg-[#FAFAFB]',
                  )}
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', chosen ? 'bg-brand-500 text-white' : 'bg-[#F4F4F5] text-muted')}>
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">{option.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{option.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {source === 'TEMPLATE' && (
            <div className="mt-5">
              <label htmlFor="request-template" className="text-[13px] font-semibold text-ink">
                Document template
              </label>
              <Select
                id="request-template"
                value={templateId}
                onChange={(id) => {
                  setTemplateId(id);
                  setError(null);
                }}
                loading={templatesLoading}
                showSearch={{
                  filterOption: (input, option) => ((option as { search?: string } | undefined)?.search ?? '').includes(input.toLowerCase()),
                }}
                placeholder="Search by code or name, e.g. FM-QA-001"
                notFoundContent={templatesLoading ? <Spin size="small" /> : 'No published document templates'}
                options={templates.map((t) => ({
                  value: t.document_template_id,
                  label: `${t.code} · ${t.name}`,
                  search: `${t.code} ${t.name}`.toLowerCase(),
                }))}
                className="mt-1.5 w-full"
              />
              {template && (
                <div className="mt-3 rounded-lg border border-line bg-[#FAFAFB] px-3.5 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="doc-code text-brand-600">{template.code}</span>
                    <span className="tnum rounded bg-surface px-1.5 py-px text-[11px] font-semibold text-ink-2 ring-1 ring-line">
                      {revisionLabel(template.current_revision?.revision_no ?? 1)}
                    </span>
                    <DocTypeTag type={template.template_type} />
                    <span className="tnum text-[12px] text-muted">
                      {template.file_count} {template.file_count === 1 ? 'file' : 'files'}
                    </span>
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-2">
                    {template.template_type === 'FLOW' ? (
                      <>
                        <Workflow size={14} className="mt-0.5 shrink-0 text-brand-500" />
                        Runs the approval route {template.approval_template_code}. Approvers and signature places are already set: you
                        only swap in your filled-in PDF and send.
                      </>
                    ) : (
                      'A normal document: you get its files, and choose who approves in the next step.'
                    )}
                  </p>
                  {template.file_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="mt-2.5 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Eye size={13} />
                      Preview the template’s files
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            <label htmlFor="request-title" className="text-[13px] font-semibold text-ink">
              Title{source === 'TEMPLATE' && <span className="font-normal text-muted"> (optional)</span>}
            </label>
            <Input
              id="request-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={source === 'TEMPLATE' ? (template?.name ?? 'Leave empty to use the template’s name') : 'e.g. Incoming inspection report, lot 2026-118'}
              className="mt-1.5"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="request-description" className="text-[13px] font-semibold text-ink">
              Note to approvers <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input.TextArea
              id="request-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              showCount
              placeholder="Anything they should know before deciding"
              className="mt-1.5"
            />
          </div>

          {error && <Alert type="error" showIcon className="mt-5!" title={error} />}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-5 py-4 sm:px-6">
          <p className="text-[12px] text-muted">Next: files and approvers. Nothing is sent yet.</p>
          <button
            type="button"
            onClick={() => void start()}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {creating ? 'Starting…' : 'Continue'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <FilePreviewModal template={previewOpen ? template : null} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
