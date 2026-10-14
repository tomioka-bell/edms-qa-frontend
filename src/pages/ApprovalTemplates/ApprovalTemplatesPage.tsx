import { useEffect, useState } from 'react';
import { App as AntApp, Input, Spin, Switch, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ListChecks, LogIn, Pencil, Plus, RotateCw, Search, ServerCrash, Trash2, Workflow } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import ApprovalRoute from '../../components/approval/ApprovalRoute';
import ApprovalTemplateFormModal from '../../components/approval/ApprovalTemplateFormModal';
import StepTypesModal from '../../components/approval/StepTypesModal';
import { ApiError } from '../../lib/api';
import { deleteApprovalTemplate, listApprovalTemplates } from '../../lib/approvalTemplates';
import type { ApprovalTemplate } from '../../types/approval';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';
import { PORTAL_URL } from '../../lib/auth';

// Where people sign in (the EDMS portal). The session cookie it sets is the one these API calls use.

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.75 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        active ? 'bg-ok-soft text-[#15803D] ring-[#BBF7D0]' : 'bg-[#F4F4F5] text-muted ring-[#E4E4E7]',
      )}
    >
      <span className={cn('size-1.25 shrink-0 rounded-full', active ? 'bg-ok' : 'bg-faint')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/** Name, code, step count and description of a template: the table's first cell and the head of a card. */
function TemplateSummary({ template }: { template: ApprovalTemplate }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-ink" title={template.name}>
        {template.name}
      </p>
      <p className="mt-1 flex items-center gap-2">
        <span className="doc-code rounded bg-brand-50 px-1.5 py-px text-[11px] text-brand-700">{template.code}</span>
        <span className="tnum text-[12px] text-muted">
          {template.step_count} {template.step_count === 1 ? 'step' : 'steps'}
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

export default function ApprovalTemplatesPage() {
  const { message, modal } = AntApp.useApp();

  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalTemplate | null>(null);
  const [stepTypesOpen, setStepTypesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listApprovalTemplates()
      .then((list) => {
        if (cancelled) return;
        setTemplates(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Could not load approval templates.'));
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

  const openEdit = (template: ApprovalTemplate) => {
    setEditing(template);
    setFormOpen(true);
  };

  const confirmDelete = (template: ApprovalTemplate) => {
    modal.confirm({
      title: `Delete ${template.code}?`,
      content: (
        <p className="text-[13.5px] text-muted">
          “{template.name}” will no longer be available for new documents. Approvals already in progress are not affected.
        </p>
      ),
      okText: 'Delete template',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteApprovalTemplate(template.template_id);
          setTemplates((list) => list.filter((t) => t.template_id !== template.template_id));
          message.success(`${template.code} deleted.`);
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Could not delete the template.');
        }
      },
    });
  };

  const q = query.trim().toLowerCase();
  const filtered = templates.filter((t) => {
    if (activeOnly && !t.is_active) return false;
    if (!q) return true;
    return (
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.steps.some((s) => s.step_name.toLowerCase().includes(q) || s.approvers.some((a) => a.name.toLowerCase().includes(q)))
    );
  });

  const rowActions = (t: ApprovalTemplate) => (
        <div className="flex items-center justify-end gap-0.5">
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

  const columns: ColumnsType<ApprovalTemplate> = [
    {
      title: 'Template',
      key: 'template',
      width: 300,
      render: (_, t) => <TemplateSummary template={t} />,
    },
    {
      title: 'Approval Steps',
      key: 'route',
      render: (_, t) => <ApprovalRoute steps={t.steps} />,
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, t) => <ActiveBadge active={t.is_active} />,
    },
    {
      title: 'Last Updated',
      key: 'updated',
      width: 150,
      render: (_, t) => (
        <span className="flex flex-col">
          <span className="tnum text-[13px] whitespace-nowrap text-ink-2">{dayjs(t.updated_at).format('DD MMM YYYY')}</span>
          <span className="doc-code text-[11px] font-medium text-faint">{t.updated_by || t.created_by}</span>
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'right',
      render: (_, t) => rowActions(t),
    },
  ];

  const newButton = (
    <button
      type="button"
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2.25 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-600 active:bg-brand-700"
    >
      <Plus size={16} strokeWidth={2.4} />
      New Template
    </button>
  );

  // Nothing to list: either no templates exist yet, or the search and filter hide them all
  const emptyState = templates.length === 0 ? (
    <EmptyState
      icon={<Workflow size={19} strokeWidth={1.75} />}
      title="No approval templates yet"
      description="Create the first route to define who approves documents and in what order."
      action={newButton}
    />
  ) : (
    <EmptyState
      compact
      title="No templates match"
      description="Try a different search, or turn off “Active only”."
    />
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
        title="Approval Templates"
        description="Reusable approval routes: who approves a document first, second, and third."
        actions={
          loadError ? undefined : (
            <>
              <button
                type="button"
                onClick={() => setStepTypesOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.25 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                <ListChecks size={15} strokeWidth={1.95} />
                Step Types
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
              title="Sign in to manage approval templates"
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
              title="Approval templates could not be loaded"
              description={loadError.message}
              action={retryButton}
            />
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                allowClear
                prefix={<Search size={15} className="text-faint" />}
                placeholder="Search by code, name, or approver"
                aria-label="Search approval templates"
                className="w-full! sm:w-80!"
              />
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                  <Switch size="small" checked={activeOnly} onChange={setActiveOnly} />
                  Active only
                </label>
                <span className="tnum text-[12.5px] text-muted">
                  {filtered.length} of {templates.length}
                </span>
              </div>
            </div>

            {/* Phones, tablets and narrow windows: one card per template. Beside the sidebar the
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
                    <li key={t.template_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <TemplateSummary template={t} />
                        <div className="-mt-1 -mr-1.5 shrink-0">{rowActions(t)}</div>
                      </div>
                      <div className="mt-3.5">
                        <ApprovalRoute steps={t.steps} />
                      </div>
                      <div className="mt-3.5 flex items-center justify-between gap-3">
                        <ActiveBadge active={t.is_active} />
                        <span className="text-[12px] text-muted">
                          Updated <span className="tnum text-ink-2">{dayjs(t.updated_at).format('DD MMM YYYY')}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden xl:block">
              <Table<ApprovalTemplate>
                rowKey="template_id"
                rowClassName="align-top"
                // Fixed layout: a long template name is cut off instead of squeezing the steps column
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

      <StepTypesModal open={stepTypesOpen} onClose={() => setStepTypesOpen(false)} />

      <ApprovalTemplateFormModal
        open={formOpen}
        template={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) => {
          setFormOpen(false);
          setTemplates((list) =>
            mode === 'created'
              ? [...list, saved].sort((a, b) => a.code.localeCompare(b.code))
              : list.map((t) => (t.template_id === saved.template_id ? saved : t)),
          );
          message.success(`${saved.code} ${mode}.`);
        }}
      />
    </div>
  );
}
