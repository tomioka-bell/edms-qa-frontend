import { useState } from 'react';
import { DatePicker, Form, Input, Modal, Select, Upload, App as AntApp } from 'antd';
import type { UploadFile } from 'antd';
import { UploadCloud, FileText, X, Info } from 'lucide-react';
import type { DocCategory, Department, ReviewCycle } from '../../types/document';
import { owners, reviewers, approvers } from '../../data/mockActivities';
import { useCurrentUser } from '../../stores/session';
import { dayjs } from '../../lib/format';

const CATEGORIES: DocCategory[] = [
  'Procedure',
  'Work Instruction',
  'Standard',
  'Form',
  'Manual',
  'Specification',
  'Record',
];

const DEPARTMENTS: Department[] = [
  'QA',
  'Production',
  'Engineering',
  'Warehouse',
  'Purchasing',
  'Maintenance',
];

const CYCLES: ReviewCycle[] = ['6 Months', '1 Year', '2 Years', '3 Years'];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (summary: string) => void;
}

/** Group heading inside the modal body — numbered so the form reads as a sequence. */
function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line px-6 py-5 last:border-b-0">
      <div className="mb-4 flex items-baseline gap-2.5">
        <span className="tnum flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
          {step}
        </span>
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.008em]">{title}</h3>
          {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DocumentFormModal({ open, onClose, onCreated }: Props) {
  const currentUser = useCurrentUser();
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null);

  const finish = async (mode: 'draft' | 'submit') => {
    try {
      if (mode === 'submit') await form.validateFields();
      else await form.validateFields(['code', 'name']);
    } catch {
      message.error('Please complete the required fields.');
      return;
    }

    setSubmitting(mode);
    const code = form.getFieldValue('code') as string;

    window.setTimeout(() => {
      setSubmitting(null);
      onCreated(
        mode === 'draft'
          ? `${code} saved as draft.`
          : `${code} submitted for approval.`,
      );
      form.resetFields();
      setFiles([]);
      onClose();
    }, 650);
  };

  const close = () => {
    form.resetFields();
    setFiles([]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      width={760}
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
        classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <p className="eyebrow">New Record</p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.018em]">Create New Document</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Register a controlled document and route it through the approval workflow.
          </p>
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
      <div className="slim-scroll max-h-[min(64vh,620px)] overflow-y-auto bg-surface">
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            revision: '01',
            reviewCycle: '1 Year',
            effectiveDate: dayjs('2026-10-01'),
            preparedBy: currentUser.name,
            reviewedBy: 'QA Manager',
            approvedBy: 'Managing Director',
          }}
        >
          <Section step={1} title="Basic Information" hint="Identification and ownership of the document">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="code"
                label="Document Code"
                rules={[
                  { required: true, message: 'Document code is required' },
                  { pattern: /^QMS-[A-Z]{1,2}-\d{3}$/, message: 'Format: QMS-P-001' },
                ]}
                tooltip={{ title: 'Format: QMS-<type>-<number>, e.g. QMS-P-001', icon: <Info size={12} /> }}
              >
                <Input placeholder="QMS-P-001" />
              </Form.Item>

              <Form.Item
                name="name"
                label="Document Name"
                rules={[{ required: true, message: 'Document name is required' }]}
              >
                <Input placeholder="e.g. Document Control Procedure" />
              </Form.Item>

              <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Select a category' }]}>
                <Select
                  placeholder="Select category"
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </Form.Item>

              <Form.Item name="department" label="Department" rules={[{ required: true, message: 'Select a department' }]}>
                <Select
                  placeholder="Select department"
                  options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                />
              </Form.Item>

              <Form.Item
                name="owner"
                label="Document Owner"
                rules={[{ required: true, message: 'Select an owner' }]}
                className="sm:col-span-2"
              >
                <Select
                  showSearch
                  placeholder="Select document owner"
                  options={owners.map((o) => ({ value: o, label: o }))}
                />
              </Form.Item>

              <Form.Item name="description" label="Description" className="sm:col-span-2 mb-0!">
                <Input.TextArea
                  rows={3}
                  maxLength={400}
                  showCount
                  placeholder="Describe the purpose and scope of this document…"
                />
              </Form.Item>
            </div>
          </Section>

          <Section step={2} title="Revision" hint="Initial issue and review scheduling">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
              <Form.Item name="revision" label="Initial Revision" className="mb-0!">
                <Input prefix={<span className="text-[12px] text-faint">Rev.</span>} />
              </Form.Item>

              <Form.Item
                name="effectiveDate"
                label="Effective Date"
                rules={[{ required: true, message: 'Select an effective date' }]}
                className="mb-0!"
              >
                <DatePicker format="DD MMM YYYY" className="w-full" />
              </Form.Item>

              <Form.Item name="reviewCycle" label="Review Cycle" className="mb-0!">
                <Select options={CYCLES.map((c) => ({ value: c, label: c }))} />
              </Form.Item>
            </div>
          </Section>

          <Section step={3} title="Document File" hint="PDF, DOCX or XLSX · maximum 20 MB">
            <Upload.Dragger
              multiple={false}
              maxCount={1}
              fileList={files}
              accept=".pdf,.docx,.xlsx"
              beforeUpload={(file) => {
                if (file.size > 20 * 1024 * 1024) {
                  message.error('File exceeds the 20 MB limit.');
                  return Upload.LIST_IGNORE;
                }
                setFiles([{ uid: file.name, name: file.name, status: 'done', size: file.size } as UploadFile]);
                return false;
              }}
              onRemove={() => {
                setFiles([]);
                return true;
              }}
              className="![&_.ant-upload]:bg-transparent"
              style={{ background: '#FAFAFB', borderRadius: 10 }}
            >
              <div className="flex flex-col items-center px-4 py-5">
                <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-brand-500">
                  <UploadCloud size={19} strokeWidth={1.85} />
                </span>
                <p className="mt-3 text-[13.5px] font-medium text-ink">
                  Drag &amp; drop a file, or{' '}
                  <span className="text-brand-600 underline decoration-brand-200 underline-offset-2">
                    browse
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-muted">PDF, DOCX, XLSX · up to 20 MB</p>
              </div>
            </Upload.Dragger>

            {files.length > 0 && (
              <div className="anim-fade mt-3 flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
                <FileText size={16} className="shrink-0 text-brand-500" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {files[0].name}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-[#F4F4F5] hover:text-ink"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </Section>

          <Section step={4} title="Approval Workflow" hint="Routing sequence for this document">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
              <Form.Item name="preparedBy" label="Prepared By" className="mb-0!">
                <Select showSearch options={owners.map((o) => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item
                name="reviewedBy"
                label="Reviewed By"
                rules={[{ required: true, message: 'Select a reviewer' }]}
                className="mb-0!"
              >
                <Select options={reviewers.map((o) => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item
                name="approvedBy"
                label="Approved By"
                rules={[{ required: true, message: 'Select an approver' }]}
                className="mb-0!"
              >
                <Select options={approvers.map((o) => ({ value: o, label: o }))} />
              </Form.Item>
            </div>
          </Section>
        </Form>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <Info size={13} className="text-faint" />
          Submitting routes the document to the reviewer immediately.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => finish('draft')}
            disabled={submitting !== null}
            className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-surface disabled:opacity-60"
          >
            {submitting === 'draft' ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => finish('submit')}
            disabled={submitting !== null}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting === 'submit' ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
