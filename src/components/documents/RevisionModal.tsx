import { useState } from 'react';
import { DatePicker, Form, Input, Modal, Select, Upload, App as AntApp } from 'antd';
import type { UploadFile } from 'antd';
import { ArrowRight, FileText, Info, UploadCloud, X } from 'lucide-react';
import type { QaDocument } from '../../types/document';
import { reviewers, approvers } from '../../data/mockActivities';
import { useCurrentUser } from '../../stores/session';
import { revLabel, fmtDate, dayjs } from '../../lib/format';

interface Props {
  doc: QaDocument | null;
  open: boolean;
  onClose: () => void;
  onCreated: (summary: string) => void;
}

const REASONS = [
  'Annual / periodic review',
  'Corrective action (CAPA)',
  'Customer requirement change',
  'Process or equipment change',
  'Audit finding',
  'Regulatory / standard update',
  'Document error correction',
];

export default function RevisionModal({ doc, open, onClose, onCreated }: Props) {
  const currentUser = useCurrentUser();
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!doc) return null;

  const nextRev = doc.revision + 1;

  const close = () => {
    form.resetFields();
    setFiles([]);
    onClose();
  };

  const submit = async () => {
    try {
      await form.validateFields();
    } catch {
      message.error('A change summary and reason are required before submission.');
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      onCreated(`${doc.code} ${revLabel(nextRev)} submitted for approval.`);
      close();
    }, 650);
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      width={680}
      closable={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
        classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow">Revision Control</p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.018em]">Create Revision</h2>
          <p className="mt-1 truncate text-[12.5px] text-muted">
            <span className="doc-code text-brand-600">{doc.code}</span> · {doc.name}
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

      {/* Revision transition strip */}
      <div className="flex items-center gap-4 border-b border-line bg-[#FAFAFB] px-6 py-4">
        <div className="flex-1">
          <p className="text-[11.5px] font-medium text-muted">Current Revision</p>
          <p className="tnum mt-1 text-[17px] font-semibold text-ink-2">{revLabel(doc.revision)}</p>
          <p className="tnum mt-0.5 text-[11.5px] text-faint">Effective {fmtDate(doc.effectiveDate)}</p>
        </div>

        <ArrowRight size={17} className="shrink-0 text-[#D4D4D8]" />

        <div className="flex-1">
          <p className="text-[11.5px] font-medium text-brand-600">New Revision</p>
          <p className="tnum mt-1 text-[17px] font-semibold text-brand-700">{revLabel(nextRev)}</p>
          <p className="mt-0.5 text-[11.5px] text-faint">Supersedes {revLabel(doc.revision)}</p>
        </div>
      </div>

      {/* Body */}
      <div className="slim-scroll max-h-[min(58vh,540px)] overflow-y-auto px-6 py-5">
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            effectiveDate: dayjs('2026-10-15'),
            preparedBy: currentUser.name,
            reviewedBy: 'QA Manager',
            approvedBy: 'Managing Director',
          }}
        >
          <Form.Item
            name="summary"
            label="Revision Description"
            rules={[
              { required: true, message: 'Describe what changed in this revision' },
              { min: 15, message: 'Please provide at least 15 characters.' },
            ]}
            extra={
              <span className="text-[11.5px] text-faint">
                Recorded in the revision history and visible to all controlled-copy holders.
              </span>
            }
          >
            <Input.TextArea
              rows={3}
              maxLength={300}
              showCount
              placeholder="e.g. Updated document retention requirements in section 7.3"
            />
          </Form.Item>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item
              name="reason"
              label="Reason for Change"
              rules={[{ required: true, message: 'Select a reason for change' }]}
            >
              <Select placeholder="Select reason" options={REASONS.map((r) => ({ value: r, label: r }))} />
            </Form.Item>

            <Form.Item
              name="effectiveDate"
              label="Effective Date"
              rules={[{ required: true, message: 'Select an effective date' }]}
            >
              <DatePicker format="DD MMM YYYY" className="w-full" />
            </Form.Item>
          </div>

          <Form.Item label="Upload New Document" className="mb-5!">
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
                setFiles([{ uid: file.name, name: file.name, status: 'done' } as UploadFile]);
                return false;
              }}
              onRemove={() => {
                setFiles([]);
                return true;
              }}
              style={{ background: '#FAFAFB', borderRadius: 10 }}
            >
              <div className="flex flex-col items-center px-4 py-4">
                <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-brand-500">
                  <UploadCloud size={17} strokeWidth={1.85} />
                </span>
                <p className="mt-2.5 text-[13px] font-medium text-ink">
                  Drop the revised file, or{' '}
                  <span className="text-brand-600 underline decoration-brand-200 underline-offset-2">
                    browse
                  </span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">PDF, DOCX, XLSX · up to 20 MB</p>
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
                  aria-label="Remove file"
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-[#F4F4F5] hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </Form.Item>

          <div className="border-t border-line pt-5">
            <h3 className="mb-3.5 text-[13px] font-semibold">Approval Workflow</h3>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
              <Form.Item name="preparedBy" label="Prepared By" className="mb-0!">
                <Input readOnly variant="filled" />
              </Form.Item>
              <Form.Item name="reviewedBy" label="Reviewed By" className="mb-0!">
                <Select options={reviewers.map((r) => ({ value: r, label: r }))} />
              </Form.Item>
              <Form.Item name="approvedBy" label="Approved By" className="mb-0!">
                <Select options={approvers.map((r) => ({ value: r, label: r }))} />
              </Form.Item>
            </div>
          </div>
        </Form>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <Info size={13} className="text-faint" />
          {revLabel(doc.revision)} will be archived automatically on approval.
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
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
