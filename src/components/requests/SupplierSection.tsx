import { useEffect, useState } from 'react';
import { App as AntApp, Popconfirm, Segmented, Select } from 'antd';
import { PencilLine, Truck } from 'lucide-react';
import SignBlockEditor, { type EditorText } from '../signBlocks/SignBlockEditor';
import type { EditableBlock } from '../signBlocks/types';
import { ApiError } from '../../lib/api';
import { documentRequestFileUrl, saveSupplierBlocks, setRequestSupplier } from '../../lib/documentRequests';
import { listSuppliers } from '../../lib/suppliers';
import type { DocumentRequest, DocumentRequestFile, SupplierBlockInput, SupplierTiming } from '../../types/documentRequest';
import type { Supplier } from '../../types/supplier';
import { cn } from '../../lib/cn';

const SUPPLIER_TEXT: EditorText = {
  eyebrow: 'Supplier',
  title: 'Mark what the supplier fills in',
  hint: 'Put a signature where they sign, and a field wherever they type something. Select a field to say what it asks for.',
  confirm: 'Save these places',
};

const TIMINGS: Array<{ value: SupplierTiming; label: string }> = [
  { value: 'BEFORE', label: 'Supplier first' },
  { value: 'AFTER', label: 'Supplier last' },
];

const fileKey = (fileId: number) => `f-${fileId}`;

interface Props {
  request: DocumentRequest;
  /** The request's PDF files: the only ones anything can be placed on */
  pdfFiles: DocumentRequestFile[];
  /** Something else on the page is being saved */
  disabled: boolean;
  /** Called with the request as the server now has it */
  onChanged: (next: DocumentRequest) => void;
}

/**
 * The part of a draft that says whether the document also goes to a supplier: which one, whether
 * before or after the approval steps, and what they fill in on the files. Most documents have none.
 * Every change is saved at once, like a file.
 */
export default function SupplierSection({ request, pdfFiles, disabled, onChanged }: Props) {
  const { message } = AntApp.useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSuppliers()
      .then((list) => {
        if (!cancelled) setSuppliers(list.filter((s) => s.is_active));
      })
      .catch(() => undefined) // the picker stays empty
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { supplier } = request;
  const blocks = request.sign_blocks.filter((b) => b.signer_kind === 'SUPPLIER');
  const signatures = blocks.filter((b) => b.content === 'SIGNATURE').length;
  const dates = blocks.filter((b) => b.content === 'DATE').length;
  const typed = blocks.filter((b) => b.content === 'FIELD');
  const busy = disabled || saving;

  const run = async (action: () => Promise<DocumentRequest>, failed: string, done?: string) => {
    setSaving(true);
    try {
      onChanged(await action());
      if (done) message.success(done);
      return true;
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : failed);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const choose = (supplierId: number | undefined) =>
    void run(() => setRequestSupplier(request.request_id, supplierId ?? null, supplier?.timing ?? 'AFTER'), 'The supplier could not be saved.');

  const savePlaces = async (edited: EditableBlock[]) => {
    const ok = await run(
      () =>
        saveSupplierBlocks(
          request.request_id,
          edited.map((b) => ({
            file_id: Number(b.fileKey.slice(2)),
            // This editor offers the supplier's signature, date and fields only, never the seal
            content: b.content as SupplierBlockInput['content'],
            label: b.field?.label.trim(),
            field_type: b.field?.type,
            field_required: b.field?.required,
            page_no: b.pageNo,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
          })),
        ),
      'The places could not be saved.',
      edited.length === 0 ? 'The supplier has nothing to fill in now.' : 'Saved what the supplier fills in.',
    );
    if (ok) setPlacing(false);
  };

  // A supplier taken off the list since it was chosen still shows by name
  const options = suppliers.map((s) => ({ value: s.supplier_id, label: `${s.name} · ${s.code}`, search: `${s.name} ${s.code}`.toLowerCase() }));
  if (supplier && !options.some((o) => o.value === supplier.supplier_id)) {
    options.unshift({ value: supplier.supplier_id, label: `${supplier.name} · ${supplier.code}`, search: '' });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="request-supplier" className="block text-[13px] font-medium text-ink-2">
          Supplier
        </label>
        <Select
          id="request-supplier"
          value={supplier?.supplier_id}
          onChange={choose}
          allowClear
          loading={loading}
          disabled={busy}
          showSearch={{
            filterOption: (input, option) => ((option as { search?: string } | undefined)?.search ?? '').includes(input.toLowerCase()),
          }}
          placeholder="None: this document stays inside the plant"
          options={options}
          className="mt-1.5 w-full sm:max-w-md"
        />
        {!supplier && blocks.length > 0 && (
          <p className="mt-1.5 text-[12px] font-medium text-[#A16207]">This form has parts a supplier fills in. Choose the supplier before sending it.</p>
        )}
      </div>

      {supplier && (
        <>
          <div>
            <p className="text-[13px] font-medium text-ink-2">When it goes to them</p>
            <Segmented<SupplierTiming>
              className="mt-1.5"
              value={supplier.timing}
              disabled={busy}
              onChange={(timing) =>
                void run(() => setRequestSupplier(request.request_id, supplier.supplier_id, timing), 'The order could not be saved.')
              }
              options={TIMINGS}
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {supplier.timing === 'BEFORE'
                ? `Sent to ${supplier.code} straight away. Once they have filled it in and signed, it comes back and your approvers take over.`
                : `Your approvers go first. When every step has passed it is sent on to ${supplier.code}, and it is complete once they have filled it in and signed.`}
            </p>
          </div>

          {pdfFiles.length === 0 ? (
            <p className="text-[12.5px] text-muted">Add a PDF file above first: what the supplier fills in can only be placed on a PDF.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', signatures > 0 ? 'bg-ok-soft text-[#15803D]' : 'bg-warn-soft text-[#A16207]')}>
                  <Truck size={17} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{signatures > 0 ? 'What the supplier fills in' : 'Not marked yet'}</p>
                  <p className="tnum text-[12px] text-muted">
                    {signatures > 0
                      ? [
                          `${signatures} ${signatures === 1 ? 'signature' : 'signatures'}`,
                          dates > 0 && `${dates} ${dates === 1 ? 'date' : 'dates'}`,
                          typed.length > 0 && `${typed.length} ${typed.length === 1 ? 'field' : 'fields'}: ${typed.map((b) => b.label).join(', ')}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Mark where they sign before sending. Fields to type into are optional.'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {blocks.length > 0 && (
                  <Popconfirm title="Clear what the supplier fills in?" okText="Clear" cancelText="Keep" onConfirm={() => void savePlaces([])}>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </Popconfirm>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPlacing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:opacity-50"
                >
                  <PencilLine size={14} />
                  {blocks.length > 0 ? 'Change' : 'Mark on the document'}
                </button>
              </div>
            </div>
          )}

          <SignBlockEditor
            open={placing}
            fields
            files={pdfFiles.map((f) => ({ key: fileKey(f.file_id), name: f.original_name, source: { url: documentRequestFileUrl(request.request_id, f.file_id, true, true) } }))}
            signers={[{ kind: 'ISSUER', stepNo: 0, label: 'Supplier', detail: supplier.name }]}
            blocks={blocks.map((b) => ({
              key: `saved-${b.sign_block_id}`,
              fileKey: fileKey(b.file_id),
              signerKind: 'ISSUER',
              stepNo: 0,
              content: b.content ?? 'SIGNATURE',
              field: b.content === 'FIELD' ? { label: b.label, type: b.field_type || 'TEXT', required: b.field_required ?? true } : undefined,
              pageNo: b.page_no,
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
            }))}
            text={SUPPLIER_TEXT}
            onClose={() => setPlacing(false)}
            onSave={(edited) => void savePlaces(edited)}
          />
        </>
      )}
    </div>
  );
}
