import { useState } from 'react';
import { Alert, Form, Input, Modal, Switch, Tooltip } from 'antd';
import { Info, Plus, Trash2, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { createSupplier, updateSupplier } from '../../lib/suppliers';
import type { Supplier, SupplierInput } from '../../types/supplier';

interface Props {
  open: boolean;
  /** Supplier being edited; null creates a new one. */
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: (saved: Supplier, mode: 'created' | 'updated') => void;
}

interface ContactValue {
  email?: string;
  name?: string;
}

interface FormValues {
  code: string;
  name: string;
  is_active: boolean;
  contacts: ContactValue[];
}

const MAX_CONTACTS = 50;

function initialValues(supplier: Supplier | null): FormValues {
  if (!supplier) return { code: '', name: '', is_active: true, contacts: [{ email: '', name: '' }] };
  return {
    code: supplier.code,
    name: supplier.name,
    is_active: supplier.is_active,
    contacts: supplier.contacts.map((c) => ({ email: c.email, name: c.name })),
  };
}

export default function SupplierFormModal({ open, supplier, onClose, onSaved }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={680}
      closable={false}
      keyboard={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog, so every opening starts from a clean form */}
      <SupplierForm supplier={supplier} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function SupplierForm({ supplier, onClose, onSaved }: Omit<Props, 'open'>) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = supplier !== null;

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const input: SupplierInput = {
      code: values.code.trim(),
      name: values.name.trim(),
      is_active: values.is_active,
      contacts: (values.contacts ?? []).map((c) => ({ email: (c.email ?? '').trim(), name: (c.name ?? '').trim() })),
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = editing ? await updateSupplier(supplier.supplier_id, input) : await createSupplier(input);
      onSaved(saved, editing ? 'updated' : 'created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the supplier. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow">Suppliers</p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.018em]">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
          <p className="mt-1 text-[12.5px] text-muted">The company, then the people to write to there.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="slim-scroll max-h-[min(66vh,660px)] overflow-y-auto px-6 py-5">
        <Form form={form} layout="vertical" requiredMark={false} disabled={submitting} initialValues={initialValues(supplier)}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_160px]">
            <Form.Item
              name="name"
              label="Vendor name"
              rules={[
                { required: true, whitespace: true, message: 'Enter the vendor name' },
                { max: 200, message: 'Up to 200 characters' },
              ]}
            >
              <Input placeholder="e.g. SANIA (THAILAND) Co., Ltd." maxLength={200} />
            </Form.Item>
            <Form.Item
              name="code"
              label="Code"
              tooltip="The supplier's short code. Letters, numbers and dashes; no spaces."
              normalize={(v: string) => v.toUpperCase()}
              rules={[
                { required: true, whitespace: true, message: 'Enter a code' },
                { max: 30, message: 'Up to 30 characters' },
                { pattern: /^\S+$/, message: 'No spaces allowed' },
              ]}
            >
              <Input placeholder="e.g. SNT" maxLength={30} className="doc-code" />
            </Form.Item>
          </div>

          <div className="mb-5 flex items-center gap-2.5">
            <Form.Item name="is_active" valuePropName="checked" noStyle>
              <Switch size="small" aria-label="Active" />
            </Form.Item>
            <span className="text-[13px] text-ink-2">Active</span>
            <span className="text-[12px] text-muted">Turn off to keep the supplier on record without using it.</span>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-[13.5px] font-semibold text-ink">Quality contacts</h3>
            <p className="mt-0.5 mb-3.5 text-[12px] leading-relaxed text-muted">
              One row per e-mail address. A company can have as many as it needs.
            </p>

            <Form.List name="contacts">
              {(fields, { add, remove }) => (
                <>
                  {fields.length === 0 && (
                    <p className="mb-3 rounded-lg border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">No contacts yet.</p>
                  )}
                  <ol className="flex flex-col gap-2">
                    {fields.map((field, index) => (
                      <li key={field.key} className="flex items-start gap-2">
                        <span className="tnum mt-1.75 w-5 shrink-0 text-right text-[12px] text-faint">{index + 1}</span>
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_200px]">
                          <Form.Item
                            name={[field.name, 'email']}
                            className="mb-0!"
                            validateTrigger={['onBlur', 'onSubmit']}
                            rules={[
                              { required: true, whitespace: true, message: 'Enter an e-mail address' },
                              { type: 'email', transform: (v: string) => (v ?? '').trim(), message: 'Not a valid e-mail address' },
                              {
                                validator: (_, value: string) => {
                                  const email = (value ?? '').trim().toLowerCase();
                                  const all = (form.getFieldValue('contacts') as ContactValue[]) ?? [];
                                  const same = all.filter((c) => (c?.email ?? '').trim().toLowerCase() === email).length;
                                  return email && same > 1 ? Promise.reject(new Error('Already listed')) : Promise.resolve();
                                },
                              },
                            ]}
                          >
                            <Input type="email" placeholder="name@company.com" maxLength={254} aria-label={`E-mail of contact ${index + 1}`} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'name']} className="mb-0!" rules={[{ max: 200, message: 'Up to 200 characters' }]}>
                            <Input placeholder="Name (optional)" maxLength={200} aria-label={`Name of contact ${index + 1}`} />
                          </Form.Item>
                        </div>
                        <Tooltip title="Remove">
                          <button
                            type="button"
                            onClick={() => remove(field.name)}
                            disabled={submitting}
                            aria-label={`Remove contact ${index + 1}`}
                            className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-60"
                          >
                            <Trash2 size={15} />
                          </button>
                        </Tooltip>
                      </li>
                    ))}
                  </ol>
                  {fields.length < MAX_CONTACTS && (
                    <button
                      type="button"
                      onClick={() => add({ email: '', name: '' })}
                      disabled={submitting}
                      className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-[#D4D4D8] px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
                    >
                      <Plus size={15} />
                      Add contact
                    </button>
                  )}
                </>
              )}
            </Form.List>
          </div>

          {error && <Alert type="error" showIcon className="mt-4!" title={error} />}
        </Form>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <Info size={13} className="text-faint" />
          The contacts listed here replace the saved ones.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-[#F1F1F4] hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Supplier'}
          </button>
        </div>
      </div>
    </>
  );
}
