import { useEffect, useState } from 'react';
import { App as AntApp, Input, Spin, Switch, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Truck, Mail, Pencil, Plus, RotateCw, Search, ServerCrash, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import SupplierFormModal from '../../components/suppliers/SupplierFormModal';
import { ApiError } from '../../lib/api';
import { deleteSupplier, listSuppliers } from '../../lib/suppliers';
import type { Supplier } from '../../types/supplier';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';

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

/** A supplier's contacts, one address per line. */
function ContactList({ supplier }: { supplier: Supplier }) {
  if (supplier.contacts.length === 0) return <span className="text-[12.5px] text-faint">No contacts</span>;
  return (
    <ul className="flex flex-col gap-1">
      {supplier.contacts.map((c) => (
        <li key={c.contact_id} className="flex min-w-0 items-center gap-2 text-[13px]">
          <Mail size={13} aria-hidden="true" className="shrink-0 text-faint" />
          <a href={`mailto:${c.email}`} className="truncate text-ink-2! hover:text-brand-600! hover:underline" title={c.email}>
            {c.email}
          </a>
          {c.name && <span className="shrink-0 text-[12px] text-muted">· {c.name}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function SuppliersPage() {
  const { message, modal } = AntApp.useApp();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSuppliers()
      .then((list) => {
        if (cancelled) return;
        setSuppliers(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Could not load suppliers.'));
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

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setFormOpen(true);
  };

  const confirmDelete = (supplier: Supplier) => {
    modal.confirm({
      title: `Delete ${supplier.code}?`,
      content: (
        <p className="text-[13.5px] text-muted">
          “{supplier.name}” and its {supplier.contact_count} {supplier.contact_count === 1 ? 'contact' : 'contacts'} will be removed from the list.
        </p>
      ),
      okText: 'Delete supplier',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteSupplier(supplier.supplier_id);
          setSuppliers((list) => list.filter((s) => s.supplier_id !== supplier.supplier_id));
          message.success(`${supplier.code} deleted.`);
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Could not delete the supplier.');
        }
      },
    });
  };

  const q = query.trim().toLowerCase();
  const filtered = suppliers.filter((s) => {
    if (activeOnly && !s.is_active) return false;
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.contacts.some((c) => c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    );
  });

  const rowActions = (s: Supplier) => (
    <div className="flex items-center justify-end gap-0.5">
      <Tooltip title="Edit">
        <button
          type="button"
          onClick={() => openEdit(s)}
          aria-label={`Edit ${s.code}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <Pencil size={15} />
        </button>
      </Tooltip>
      <Tooltip title="Delete">
        <button
          type="button"
          onClick={() => confirmDelete(s)}
          aria-label={`Delete ${s.code}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
        >
          <Trash2 size={15} />
        </button>
      </Tooltip>
    </div>
  );

  const columns: ColumnsType<Supplier> = [
    {
      title: 'No.',
      key: 'no',
      width: 64,
      render: (_, __, index) => <span className="tnum text-[13px] text-muted">{index + 1}</span>,
    },
    {
      title: 'Vendor Name',
      key: 'name',
      render: (_, s) => (
        <p className="truncate text-[14px] font-semibold text-ink" title={s.name}>
          {s.name}
        </p>
      ),
    },
    {
      title: 'Code',
      key: 'code',
      width: 120,
      render: (_, s) => <span className="doc-code rounded bg-brand-50 px-1.5 py-px text-[12px] text-brand-700">{s.code}</span>,
    },
    {
      title: 'Quality',
      key: 'contacts',
      render: (_, s) => <ContactList supplier={s} />,
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, s) => <ActiveBadge active={s.is_active} />,
    },
    {
      title: 'Last Updated',
      key: 'updated',
      width: 140,
      render: (_, s) => (
        <span className="flex flex-col">
          <span className="tnum text-[13px] whitespace-nowrap text-ink-2">{dayjs(s.updated_at).format('DD MMM YYYY')}</span>
          <span className="doc-code text-[11px] font-medium text-faint">{s.updated_by || s.created_by}</span>
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'right',
      render: (_, s) => rowActions(s),
    },
  ];

  const newButton = (
    <button
      type="button"
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2.25 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-600 active:bg-brand-700"
    >
      <Plus size={16} strokeWidth={2.4} />
      New Supplier
    </button>
  );

  // Nothing to list: either no suppliers exist yet, or the search and filter hide them all
  const emptyState =
    suppliers.length === 0 ? (
      <EmptyState
        icon={<Truck size={19} strokeWidth={1.75} />}
        title="No suppliers yet"
        description="Add the first vendor and the people to write to there."
        action={newButton}
      />
    ) : (
      <EmptyState compact title="No suppliers match" description="Try a different search, or turn off “Active only”." />
    );

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Administration"
        title="Suppliers"
        description="Vendor companies and their quality contacts. One company can have several."
        actions={loadError ? undefined : newButton}
      />

      <div className="anim-rise panel mt-6 overflow-hidden">
        {loadError ? (
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title="Suppliers could not be loaded"
            description={loadError.message}
            action={
              <button
                type="button"
                onClick={reload}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                <RotateCw size={14} />
                Try again
              </button>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                allowClear
                prefix={<Search size={15} className="text-faint" />}
                placeholder="Search by name, code, or e-mail"
                aria-label="Search suppliers"
                className="w-full! sm:w-80!"
              />
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                  <Switch size="small" checked={activeOnly} onChange={setActiveOnly} />
                  Active only
                </label>
                <span className="tnum text-[12.5px] text-muted">
                  {filtered.length} of {suppliers.length}
                </span>
              </div>
            </div>

            {/* Phones, tablets and narrow windows: one card per supplier */}
            <div className="xl:hidden">
              {loading ? (
                <div className="grid h-40 place-items-center">
                  <Spin />
                </div>
              ) : filtered.length === 0 ? (
                emptyState
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((s) => (
                    <li key={s.supplier_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink" title={s.name}>
                            {s.name}
                          </p>
                          <p className="mt-1 flex items-center gap-2">
                            <span className="doc-code rounded bg-brand-50 px-1.5 py-px text-[11px] text-brand-700">{s.code}</span>
                            <ActiveBadge active={s.is_active} />
                          </p>
                        </div>
                        <div className="-mt-1 -mr-1.5 shrink-0">{rowActions(s)}</div>
                      </div>
                      <div className="mt-3">
                        <ContactList supplier={s} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden xl:block">
              <Table<Supplier>
                rowKey="supplier_id"
                rowClassName="align-top"
                tableLayout="fixed"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                pagination={filtered.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
                scroll={{ x: 940 }}
                locale={{ emptyText: loading ? <div className="h-40" /> : emptyState }}
              />
            </div>
          </>
        )}
      </div>

      <SupplierFormModal
        open={formOpen}
        supplier={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) => {
          setFormOpen(false);
          setSuppliers((list) =>
            mode === 'created'
              ? [...list, saved].sort((a, b) => a.code.localeCompare(b.code))
              : list.map((s) => (s.supplier_id === saved.supplier_id ? saved : s)),
          );
          message.success(`${saved.code} ${mode}.`);
        }}
      />
    </div>
  );
}
