import { useEffect, useState } from 'react';
import { App as AntApp, Input, Select, Spin, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Download, Eye, FileStack, History, LogIn, Pencil, Plus, RotateCw, Search, ServerCrash, Tags, Trash2, Workflow } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import DocumentCategoriesModal from '../../components/documentTemplates/DocumentCategoriesModal';
import DocumentTemplateFormModal from '../../components/documentTemplates/DocumentTemplateFormModal';
import FileChip from '../../components/documentTemplates/FileChip';
import FilePreviewModal from '../../components/documentTemplates/FilePreviewModal';
import RevisionHistoryModal from '../../components/documentTemplates/RevisionHistoryModal';
import { ApiError } from '../../lib/api';
import {
  deleteDocumentTemplate,
  documentTemplateFileUrl,
  formatFileSize,
  listDocumentTemplates,
  revisionLabel,
} from '../../lib/documentTemplates';
import type { DocumentTemplate, DocumentTemplateFile } from '../../types/documentTemplate';
import { downloadCsv, type CsvColumn } from '../../lib/exportCsv';
import { dayjs } from '../../lib/format';
import { PORTAL_URL } from '../../lib/auth';

// Where people sign in (the EDMS portal). The session cookie it sets is the one these API calls use.

// Files listed in full in a row before the rest collapse into "+N more"
const VISIBLE_FILES = 3;

// What an export of the list contains, one row per document
const EXPORT_COLUMNS: CsvColumn<DocumentTemplate>[] = [
  { header: 'Document code', value: (t) => t.code },
  { header: 'Document name', value: (t) => t.name },
  { header: 'Revision', value: (t) => (t.current_revision ? revisionLabel(t.current_revision.revision_no) : 'Not published') },
  { header: 'Effective date', value: (t) => t.current_revision?.effective_date ?? '' },
  { header: 'Category', value: (t) => t.category_name_en },
  { header: 'Department', value: (t) => t.department_code },
  { header: 'Type', value: (t) => (t.template_type === 'FLOW' ? 'Approval flow' : 'Normal') },
  { header: 'Approval template', value: (t) => t.approval_template_code },
  { header: 'Description', value: (t) => t.description },
  { header: 'Files', value: (t) => t.file_count },
  { header: 'File names', value: (t) => t.files.map((f) => (f.label ? `${f.label} (${f.original_name})` : f.original_name)).join('; ') },
  { header: 'Last updated', value: (t) => dayjs(t.updated_at).format('YYYY-MM-DD HH:mm') },
  { header: 'Updated by', value: (t) => t.updated_by || t.created_by },
];

/** Code, name, file count and description: the table's first cell and the head of a card. */
function DocumentSummary({ template }: { template: DocumentTemplate }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-ink" title={template.name}>
        {template.name}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="doc-code rounded bg-brand-50 px-1.5 py-px text-[11px] text-brand-700">{template.code}</span>
        {template.current_revision ? (
          <span className="tnum rounded bg-[#F4F4F5] px-1.5 py-px text-[11px] font-semibold text-ink-2">
            {revisionLabel(template.current_revision.revision_no)}
          </span>
        ) : (
          <span className="rounded bg-warn-soft px-1.5 py-px text-[11px] font-semibold text-[#A16207]">Not published</span>
        )}
        {/* A newer revision someone started and has not finished */}
        {template.current_revision && template.draft_revision && (
          <span className="tnum rounded bg-warn-soft px-1.5 py-px text-[11px] font-semibold text-[#A16207]">
            {revisionLabel(template.draft_revision.revision_no)} draft
          </span>
        )}
        <span className="tnum text-[12px] text-muted">
          {template.file_count} {template.file_count === 1 ? 'file' : 'files'}
        </span>
      </p>
      {template.description && (
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted" title={template.description}>
          {template.description}
        </p>
      )}
    </div>
  );
}

function FileLink({ templateId, file }: { templateId: number; file: DocumentTemplateFile }) {
  return (
    <a
      href={documentTemplateFileUrl(templateId, file.file_id)}
      title={`Download ${file.original_name}`}
      className="group flex min-w-0 items-center gap-2 rounded-md py-0.5 pr-1.5"
    >
      <FileChip extension={file.extension} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-ink-2 group-hover:text-brand-600 group-hover:underline">
          {file.label || file.original_name}
        </span>
        <span className="tnum block truncate text-[11px] text-faint">
          {file.label ? `${file.original_name} · ` : ''}
          {formatFileSize(file.size_bytes)}
        </span>
      </span>
    </a>
  );
}

/** A template's files, each a download link. */
function FileList({ template }: { template: DocumentTemplate }) {
  if (template.files.length === 0) {
    return <span className="text-[12.5px] text-faint italic">No files yet</span>;
  }
  const shown = template.files.slice(0, VISIBLE_FILES);
  const hidden = template.files.slice(VISIBLE_FILES);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {shown.map((file) => (
        <FileLink key={file.file_id} templateId={template.document_template_id} file={file} />
      ))}
      {hidden.length > 0 && (
        <Tooltip
          placement="bottomLeft"
          color="#fff"
          title={
            <div className="flex max-w-72 flex-col gap-1 py-0.5">
              {hidden.map((file) => (
                <FileLink key={file.file_id} templateId={template.document_template_id} file={file} />
              ))}
            </div>
          }
        >
          <span className="w-fit cursor-default text-[12px] font-medium text-muted underline decoration-dotted underline-offset-2">
            +{hidden.length} more
          </span>
        </Tooltip>
      )}
    </div>
  );
}

export default function DocumentTemplatesPage() {
  const { message, modal } = AntApp.useApp();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [historyOf, setHistoryOf] = useState<DocumentTemplate | null>(null);
  const [previewOf, setPreviewOf] = useState<DocumentTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDocumentTemplates()
      .then((list) => {
        if (cancelled) return;
        setTemplates(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Could not load document templates.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (template: DocumentTemplate) => {
    setEditing(template);
    setFormOpen(true);
  };

  /** Puts a saved template into the list, replacing its old version or adding it in code order. */
  const upsert = (saved: DocumentTemplate) =>
    setTemplates((list) =>
      list.some((t) => t.document_template_id === saved.document_template_id)
        ? list.map((t) => (t.document_template_id === saved.document_template_id ? saved : t))
        : [...list, saved].sort((a, b) => a.code.localeCompare(b.code)),
    );

  const confirmDelete = (template: DocumentTemplate) => {
    modal.confirm({
      title: `Delete ${template.code}?`,
      content: (
        <p className="text-[13.5px] text-muted">
          “{template.name}” with all its revisions and files will no longer be listed. Nothing is destroyed: an administrator can
          restore it.
        </p>
      ),
      okText: 'Delete document',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteDocumentTemplate(template.document_template_id);
          setTemplates((list) => list.filter((t) => t.document_template_id !== template.document_template_id));
          message.success(`${template.code} deleted.`);
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Could not delete the document.');
        }
      },
    });
  };

  // Filter choices come from what is actually in the list, so no option ever leads to an empty result by itself
  const categoryChoices = [...new Map(templates.map((t) => [t.category_id, t.category_name_en])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const departmentChoices = [...new Map(templates.map((t) => [t.department_id, t.department_code])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const q = query.trim().toLowerCase();
  const filtered = templates.filter((t) => {
    if (categoryId !== undefined && t.category_id !== categoryId) return false;
    if (departmentId !== undefined && t.department_id !== departmentId) return false;
    if (!q) return true;
    return (
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.files.some((f) => f.label.toLowerCase().includes(q) || f.original_name.toLowerCase().includes(q))
    );
  });
  const filtering = q !== '' || categoryId !== undefined || departmentId !== undefined;

  console.log('filtered', filtered);
  // Exports what the list is showing: the search and filters apply to the file as they do on screen
  const exportList = () => {
    downloadCsv(`document-templates-${dayjs().format('YYYY-MM-DD')}.csv`, EXPORT_COLUMNS, filtered);
    message.success(`Exported ${filtered.length} ${filtered.length === 1 ? 'document' : 'documents'}.`);
  };

  const rowActions = (t: DocumentTemplate) => (
    <div className="flex items-center justify-end gap-0.5">
      <Tooltip title={t.file_count === 0 ? 'No files to preview' : 'Preview files'}>
        <button
          type="button"
          onClick={() => setPreviewOf(t)}
          disabled={t.file_count === 0}
          aria-label={`Preview ${t.code}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink disabled:opacity-35"
        >
          <Eye size={15} />
        </button>
      </Tooltip>
      <Tooltip title="Revision history">
        <button
          type="button"
          onClick={() => setHistoryOf(t)}
          aria-label={`Revision history of ${t.code}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <History size={15} />
        </button>
      </Tooltip>
      <Tooltip title="Edit">
        <button
          type="button"
          onClick={() => openEdit(t)}
          aria-label={`Edit ${t.code}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <Pencil size={15} />
        </button>
      </Tooltip>
      <Tooltip title="Delete">
        <button
          type="button"
          onClick={() => confirmDelete(t)}
          aria-label={`Delete ${t.code}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
        >
          <Trash2 size={15} />
        </button>
      </Tooltip>
    </div>
  );

  const classification = (t: DocumentTemplate) => (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-ink-2">{t.category_name_en}</p>
      <p className="mt-0.5 truncate text-[12px] text-muted" title={t.department_name}>
        {t.department_code}
      </p>
      {t.template_type === 'FLOW' && (
        <p
          className="mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-medium text-brand-700"
          title={`Runs approval template ${t.approval_template_code} · ${t.approval_template_name}`}
        >
          <Workflow size={12} className="shrink-0" />
          <span className="truncate">
            {t.approval_template_code || 'Approval flow'} · {t.sign_block_count} {t.sign_block_count === 1 ? 'block' : 'blocks'}
          </span>
        </p>
      )}
    </div>
  );

  const columns: ColumnsType<DocumentTemplate> = [
    { title: 'Document', key: 'document', width: 300, render: (_, t) => <DocumentSummary template={t} /> },
    { title: 'Category / Department', key: 'classification', width: 210, render: (_, t) => classification(t) },
    { title: 'Files', key: 'files', render: (_, t) => <FileList template={t} /> },
    {
      title: 'Last Updated',
      key: 'updated',
      width: 140,
      render: (_, t) => (
        <span className="flex flex-col">
          <span className="tnum text-[13px] whitespace-nowrap text-ink-2">{dayjs(t.updated_at).format('DD MMM YYYY')}</span>
          <span className="doc-code text-[11px] font-medium text-faint">{t.updated_by || t.created_by}</span>
        </span>
      ),
    },
    { title: '', key: 'actions', width: 150, align: 'right', render: (_, t) => rowActions(t) },
  ];

  const newButton = (
    <button
      type="button"
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2.25 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-600 active:bg-brand-700"
    >
      <Plus size={16} strokeWidth={2.4} />
      New Document
    </button>
  );

  // Nothing to list: either no templates exist yet, or the search and filters hide them all
  const emptyState =
    templates.length === 0 ? (
      <EmptyState
        icon={<FileStack size={19} strokeWidth={1.75} />}
        title="No document templates yet"
        description="Add the first document code and upload the files that belong to it."
        action={newButton}
      />
    ) : (
      <EmptyState compact title="No documents match" description="Try a different search, or clear the category and department filters." />
    );

  const retryButton = (
    <button
      type="button"
      onClick={reload}
      className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
    >
      <RotateCw size={14} />
      Try again
    </button>
  );

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Administration"
        title="Document Templates"
        description="Each document code, its files, and every revision of them."
        actions={
          loadError ? undefined : (
            <>
              <Tooltip title={filtered.length === 0 ? 'Nothing to export' : filtering ? 'Exports the documents matching your search and filters' : 'Exports every document in the list'}>
                <button
                  type="button"
                  onClick={exportList}
                  disabled={loading || filtered.length === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.25 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-50"
                >
                  <Download size={15} strokeWidth={1.95} />
                  Export
                </button>
              </Tooltip>
              <button
                type="button"
                onClick={() => setCategoriesOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.25 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                <Tags size={15} strokeWidth={1.95} />
                Categories
              </button>
              {newButton}
            </>
          )
        }
      />

      <div className="anim-rise panel mt-6 overflow-hidden">
        {loadError ? (
          loadError.status === 401 ? (
            <EmptyState
              icon={<LogIn size={19} strokeWidth={1.75} />}
              title="Sign in to manage document templates"
              description="Your session has ended or you have not signed in yet. Sign in through the EDMS portal, then come back and try again."
              action={
                <div className="flex items-center gap-2">
                  <a
                    href={`${PORTAL_URL}/login`}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! transition-colors hover:bg-brand-600!"
                  >
                    <LogIn size={14} />
                    Go to sign in
                  </a>
                  {retryButton}
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={<ServerCrash size={19} strokeWidth={1.75} />}
              title="Document templates could not be loaded"
              description={loadError.message}
              action={retryButton}
            />
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                allowClear
                prefix={<Search size={15} className="text-faint" />}
                placeholder="Search by code, name, or file"
                aria-label="Search document templates"
                className="w-full! sm:w-72!"
              />
              <Select
                value={categoryId}
                onChange={setCategoryId}
                allowClear
                placeholder="All categories"
                aria-label="Filter by category"
                options={categoryChoices}
                className="w-full! sm:w-48!"
              />
              <Select
                value={departmentId}
                onChange={setDepartmentId}
                allowClear
                placeholder="All departments"
                aria-label="Filter by department"
                options={departmentChoices}
                className="w-full! sm:w-56!"
              />
              <span className="tnum text-[12.5px] text-muted sm:ml-auto">
                {filtering ? `${filtered.length} of ${templates.length}` : `${templates.length} ${templates.length === 1 ? 'document' : 'documents'}`}
              </span>
            </div>

            {/* Phones, tablets and narrow windows: one card per document. Beside the sidebar the
                five-column table only has room from the xl breakpoint up. */}
            <div className="xl:hidden">
              {loading ? (
                <div className="grid h-40 place-items-center">
                  <Spin />
                </div>
              ) : filtered.length === 0 ? (
                emptyState
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((t) => (
                    <li key={t.document_template_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <DocumentSummary template={t} />
                        <div className="-mt-1 -mr-1.5 shrink-0">{rowActions(t)}</div>
                      </div>
                      <div className="mt-3">{classification(t)}</div>
                      <div className="mt-3">
                        <FileList template={t} />
                      </div>
                      <p className="mt-3 text-[12px] text-muted">
                        Updated <span className="tnum text-ink-2">{dayjs(t.updated_at).format('DD MMM YYYY')}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden xl:block">
              <Table<DocumentTemplate>
                rowKey="document_template_id"
                rowClassName="align-top"
                // Fixed layout: a long document name is cut off instead of squeezing the files column
                tableLayout="fixed"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                pagination={filtered.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                scroll={{ x: 940 }}
                locale={{ emptyText: loading ? <div className="h-40" /> : emptyState }}
              />
            </div>
          </>
        )}
      </div>

      <DocumentCategoriesModal
        open={categoriesOpen}
        onClose={() => {
          setCategoriesOpen(false);
          reload(); // a renamed category shows on every row that uses it
        }}
      />

      <FilePreviewModal template={previewOf} onClose={() => setPreviewOf(null)} />

      <RevisionHistoryModal template={historyOf} onClose={() => setHistoryOf(null)} />

      <DocumentTemplateFormModal
        open={formOpen}
        template={editing}
        onClose={() => setFormOpen(false)}
        onPartlySaved={upsert}
        onSaved={(saved, mode) => {
          setFormOpen(false);
          upsert(saved);
          message.success(`${saved.code} ${mode}.`);
        }}
      />
    </div>
  );
}
