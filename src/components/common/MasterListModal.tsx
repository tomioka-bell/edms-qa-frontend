import { useEffect, useState } from 'react';
import { Alert, App as AntApp, Form, Input, Modal, Spin, Switch, Tooltip } from 'antd';
import { Check, Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';

/** One row of a small master list: something with an English name, an optional Thai name and an on/off switch. */
export interface MasterItem {
  id: number;
  code: string;
  name_en: string;
  name_th: string;
  is_active: boolean;
}

/** Wording and backend calls that turn this dialog into "Step Types", "Document Categories", ... */
export interface MasterListConfig {
  eyebrow: string;
  title: string;
  description: string;
  /** Singular, lower case, as it reads in a sentence: "step type" */
  noun: string;
  addLabel: string;
  namePlaceholder: string;
  thaiPlaceholder: string;
  /** What switching an item off means, for the tooltip on the switch */
  activeHint: { on: string; off: string };
  deleteNote: string;
  footerNote: string;
  list: () => Promise<MasterItem[]>;
  create: (input: { name_en: string; name_th: string }) => Promise<MasterItem>;
  update: (id: number, input: { code: string; name_en: string; name_th: string; is_active: boolean }) => Promise<MasterItem>;
  remove: (id: number) => Promise<void>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  config: MasterListConfig;
}

interface NameValues {
  name_en: string;
  name_th?: string;
}

const NAME_RULES = [
  { required: true, whitespace: true, message: 'Enter a name' },
  { max: 100, message: 'Up to 100 characters' },
];

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export default function MasterListModal({ open, onClose, config }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={640}
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog, so every opening loads the current list */}
      <MasterList onClose={onClose} config={config} />
    </Modal>
  );
}

function MasterList({ onClose, config }: { onClose: () => void; config: MasterListConfig }) {
  const { message, modal } = AntApp.useApp();
  const [addForm] = Form.useForm<NameValues>();
  const [editForm] = Form.useForm<NameValues>();

  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    config
      .list()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorText(err, `Could not load the list.`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const add = async (values: NameValues) => {
    setAdding(true);
    setAddError(null);
    try {
      const created = await config.create({ name_en: values.name_en.trim(), name_th: (values.name_th ?? '').trim() });
      setItems((list) => [...list, created]);
      addForm.resetFields();
      message.success(`${created.name_en} added.`);
    } catch (err) {
      setAddError(errorText(err, `Could not add the ${config.noun}.`));
    } finally {
      setAdding(false);
    }
  };

  // Rename or switch active: the backend takes the whole record, so untouched fields are sent back as they are.
  const save = async (item: MasterItem, patch: Partial<Pick<MasterItem, 'name_en' | 'name_th' | 'is_active'>>) => {
    setBusyId(item.id);
    try {
      const updated = await config.update(item.id, {
        code: item.code,
        name_en: patch.name_en ?? item.name_en,
        name_th: patch.name_th ?? item.name_th,
        is_active: patch.is_active ?? item.is_active,
      });
      setItems((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      return true;
    } catch (err) {
      message.error(errorText(err, `Could not save the ${config.noun}.`));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (item: MasterItem) => {
    editForm.setFieldsValue({ name_en: item.name_en, name_th: item.name_th });
    setEditingId(item.id);
  };

  const saveEdit = async (item: MasterItem) => {
    let values: NameValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    const ok = await save(item, { name_en: values.name_en.trim(), name_th: (values.name_th ?? '').trim() });
    if (ok) setEditingId(null);
  };

  const confirmDelete = (item: MasterItem) => {
    modal.confirm({
      title: `Delete “${item.name_en}”?`,
      content: (
        <p className="text-[13.5px] text-muted">{config.deleteNote}</p>
      ),
      okText: `Delete ${config.noun}`,
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await config.remove(item.id);
          setItems((list) => list.filter((t) => t.id !== item.id));
          message.success(`${item.name_en} deleted.`);
        } catch (err) {
          message.error(errorText(err, `Could not delete the ${config.noun}.`));
        }
      },
    });
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow">{config.eyebrow}</p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.018em]">{config.title}</h2>
          <p className="mt-1 text-[12.5px] text-muted">{config.description}</p>
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

      {/* Add */}
      <div className="border-b border-line bg-[#FAFAFB] px-6 py-4">
        <Form form={addForm} layout="vertical" requiredMark={false} disabled={adding || loadError !== null} onFinish={add}>
          <div className="grid grid-cols-1 items-start gap-x-3 sm:grid-cols-[1fr_1fr_auto]">
            <Form.Item name="name_en" label={config.addLabel} className="mb-0!" rules={NAME_RULES}>
              <Input placeholder={config.namePlaceholder} maxLength={100} />
            </Form.Item>
            <Form.Item name="name_th" label="Thai name (optional)" className="mb-0!" rules={[{ max: 100, message: 'Up to 100 characters' }]}>
              <Input placeholder={config.thaiPlaceholder} maxLength={100} />
            </Form.Item>
            <button
              type="submit"
              disabled={adding || loadError !== null}
              className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60 sm:mt-0 sm:self-end"
            >
              <Plus size={15} strokeWidth={2.4} />
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </Form>
        {addError && <Alert type="error" showIcon className="mt-3!" title={addError} />}
      </div>

      {/* List */}
      <div className="slim-scroll max-h-[min(50vh,440px)] overflow-y-auto">
        {loading ? (
          <div className="grid h-40 place-items-center">
            <Spin />
          </div>
        ) : loadError ? (
          <div className="px-6 py-5">
            <Alert type="warning" showIcon title="The list could not be loaded" description={loadError} />
          </div>
        ) : items.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-muted">Nothing here yet. Add the first one above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const editing = editingId === item.id;
              const busy = busyId === item.id;
              return (
                <li key={item.id} className="flex items-center gap-3 px-6 py-3">
                  {editing ? (
                    <Form form={editForm} disabled={busy} className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2" onFinish={() => void saveEdit(item)}>
                      <Form.Item name="name_en" className="mb-0!" rules={NAME_RULES}>
                        <Input maxLength={100} aria-label="Name (English)" autoFocus />
                      </Form.Item>
                      <Form.Item name="name_th" className="mb-0!" rules={[{ max: 100, message: 'Up to 100 characters' }]}>
                        <Input maxLength={100} aria-label="Thai name" placeholder="Thai name (optional)" />
                      </Form.Item>
                      {/* Lets Enter in either field save */}
                      <button type="submit" hidden />
                    </Form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[13.5px] font-medium', item.is_active ? 'text-ink' : 'text-muted')}>
                        {item.name_en}
                        {item.name_th && <span className="font-normal text-muted"> · {item.name_th}</span>}
                      </p>
                      <p className="doc-code mt-0.5 text-[11px] font-medium text-faint">{item.code}</p>
                    </div>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    {editing ? (
                      <>
                        <Tooltip title="Save">
                          <button
                            type="button"
                            onClick={() => void saveEdit(item)}
                            disabled={busy}
                            aria-label={`Save ${item.name_en}`}
                            className="rounded-md p-1.5 text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50"
                          >
                            <Check size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={busy}
                            aria-label="Cancel editing"
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink disabled:opacity-50"
                          >
                            <X size={16} />
                          </button>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip title={item.is_active ? config.activeHint.on : config.activeHint.off}>
                          <Switch
                            size="small"
                            checked={item.is_active}
                            loading={busy}
                            aria-label={`${item.name_en} active`}
                            onChange={(checked) => void save(item, { is_active: checked })}
                            className="mr-1.5!"
                          />
                        </Tooltip>
                        <Tooltip title="Rename">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label={`Rename ${item.name_en}`}
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
                          >
                            <Pencil size={15} />
                          </button>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <button
                            type="button"
                            onClick={() => confirmDelete(item)}
                            aria-label={`Delete ${item.name_en}`}
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
                          >
                            <Trash2 size={15} />
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <Info size={13} className="text-faint" />
          {config.footerNote}
        </p>
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
