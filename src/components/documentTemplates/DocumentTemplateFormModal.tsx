import { useEffect, useRef, useState } from 'react';
import { Alert, App as AntApp, Form, Input, Modal, Segmented, Select, Tooltip } from 'antd';
import { Download, GitBranch, Info, PenTool, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  createDocumentTemplate,
  discardDocumentTemplateRevision,
  documentTemplateFileUrl,
  fileExtension,
  formatFileSize,
  getDocumentTemplate,
  listDepartments,
  listDocumentCategories,
  publishDocumentTemplateRevision,
  removeDocumentTemplateFile,
  renameDocumentTemplateFile,
  revisionLabel,
  saveDocumentTemplateSignBlocks,
  startDocumentTemplateRevision,
  updateDocumentTemplate,
  updateDocumentTemplateRevision,
  uploadDocumentTemplateFile,
} from '../../lib/documentTemplates';
import { listApprovalTemplates } from '../../lib/approvalTemplates';
import { describeApprovers, describeChosenLater } from '../../lib/approvalText';
import type { ApprovalTemplate } from '../../types/approval';
import type {
  Department,
  DocumentCategory,
  DocumentTemplate,
  DocumentTemplateInput,
  DocumentTemplateRevision,
  SignBlockInput,
  TemplateType,
} from '../../types/documentTemplate';
import SignBlockEditor from '../signBlocks/SignBlockEditor';
import sealUrl from '../../e-signature/Seal.png';
import { signerColor, signerKey, type EditableBlock, type EditorFile, type Signer } from '../signBlocks/types';
import FileChip from './FileChip';
import { cn } from '../../lib/cn';

interface Props {
  open: boolean;
  /** Template being edited; null creates a new one. */
  template: DocumentTemplate | null;
  onClose: () => void;
  /** Everything was saved; the dialog should close. */
  onSaved: (saved: DocumentTemplate, mode: 'created' | 'updated') => void;
  /** The template was saved but some files were not; the dialog stays open so they can be retried. */
  onPartlySaved: (saved: DocumentTemplate) => void;
}

interface FormValues {
  code: string;
  name: string;
  description: string;
  category_id?: number;
  department_id?: number;
  template_type: TemplateType;
  approval_template_id?: number | null;
}

// Plain-language wording for the two kinds of template
const TEMPLATE_TYPES: Array<{ value: TemplateType; label: string }> = [
  { value: 'NORMAL', label: 'Normal document' },
  { value: 'FLOW', label: 'Runs an approval flow' },
];

// A file already on the server and a file still waiting to be uploaded, as the block editor names them
const savedFileKey = (fileId: number) => `f:${fileId}`;
const pendingFileKey = (key: string) => `p:${key}`;

/** A file chosen in this dialog and not uploaded yet. */
interface PendingFile {
  key: string;
  file: File;
  label: string;
  error?: string;
}

const LABEL_PLACEHOLDER = 'What is this file? e.g. Main form';

/** The signature layout the form starts with: that of the revision it shows. */
function initialBlocks(template: DocumentTemplate | null): EditableBlock[] {
  const revision = template?.draft_revision ?? template?.current_revision;
  return (revision?.sign_blocks ?? []).map((b) => ({
    key: `saved-${b.sign_block_id}`,
    fileKey: savedFileKey(b.file_id),
    signerKind: b.signer_kind,
    content: b.content ?? 'SIGNATURE',
    field: b.content === 'FIELD' ? { label: b.label, type: b.field_type || 'TEXT', required: b.field_required ?? true } : undefined,
    stepNo: b.step_no,
    pageNo: b.page_no,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
  }));
}

/** A layout as plain text, for telling whether it was changed. */
const layoutSignature = (blocks: EditableBlock[]) =>
  blocks
    .map((b) => [b.fileKey, b.signerKind, b.stepNo, b.content, b.field?.label ?? '', b.field?.type ?? '', b.field?.required ?? '', b.pageNo, b.x.toFixed(4), b.y.toFixed(4), b.width.toFixed(4), b.height.toFixed(4)].join('|'))
    .sort()
    .join(';');

/** What the form starts with: an unfinished draft's details if there is one, otherwise the document's. */
function initialDetails(template: DocumentTemplate | null): FormValues {
  const source = template?.draft_revision ?? template;
  if (!source) return { code: '', name: '', description: '', template_type: 'NORMAL', approval_template_id: null };
  return {
    code: source.code,
    name: source.name,
    description: source.description,
    category_id: source.category_id,
    department_id: source.department_id,
    template_type: source.template_type,
    approval_template_id: source.approval_template_id,
  };
}

export default function DocumentTemplateFormModal({ open, template, onClose, onSaved, onPartlySaved }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={760}
      closable={false}
      keyboard={false}
      footer={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ container: '!p-0 overflow-hidden' }}
      destroyOnHidden
    >
      {/* Unmounted with the dialog, so every opening starts from a clean form */}
      <TemplateForm template={template} onClose={onClose} onSaved={onSaved} onPartlySaved={onPartlySaved} />
    </Modal>
  );
}

function TemplateForm({ template, onClose, onSaved, onPartlySaved }: Omit<Props, 'open'>) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const fileInput = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [approvalTemplates, setApprovalTemplates] = useState<ApprovalTemplate[]>([]);
  // Where signatures go on the PDFs (flow documents), and whether the editor for it is open
  const [blocks, setBlocks] = useState<EditableBlock[]>(() => initialBlocks(template));
  const [layoutBaseline, setLayoutBaseline] = useState(() => layoutSignature(initialBlocks(template)));
  const [editorOpen, setEditorOpen] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // The template as the server last returned it. Null until a new template has been created, after
  // which saving again updates it instead of creating a second one.
  const [current, setCurrent] = useState<DocumentTemplate | null>(template);
  // Edits to files already on the server, applied on save
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [removed, setRemoved] = useState<number[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  // What the revision being made changes. Its effective date is not asked for: the backend sets it
  // to the day the revision is published.
  const [changeSummary, setChangeSummary] = useState(template?.draft_revision?.change_summary ?? '');

  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True when the error is about something still to fill in, rather than a save that half-worked
  const [errorIsInput, setErrorIsInput] = useState(false);
  const submitting = progress !== null;

  // A save that half-worked reports below the file list, which may be scrolled out of view
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  const editing = current !== null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDocumentCategories(true), listDepartments(), listApprovalTemplates()])
      .then(([cats, depts, approvals]) => {
        if (cancelled) return;
        setCategories(cats);
        setDepartments(depts);
        setApprovalTemplates(approvals);
      })
      .catch((err: unknown) => {
        if (!cancelled) setOptionsError(err instanceof Error ? err.message : 'Could not load the categories and departments.');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = categories.map((c) => ({
    value: c.category_id,
    label: c.name_th ? `${c.name_en} · ${c.name_th}` : c.name_en,
  }));
  // A category or department the template already has may since have been switched off; keep it readable.
  const shown = current?.draft_revision ?? current?.current_revision ?? null;
  if (shown && !categories.some((c) => c.category_id === shown.category_id)) {
    categoryOptions.push({ value: shown.category_id, label: `${shown.category_name} (no longer active)` });
  }
  const departmentOptions = departments.map((d) => ({ value: d.department_id, label: d.code, name: d.name }));
  if (shown && !departments.some((d) => d.department_id === shown.department_id)) {
    departmentOptions.push({
      value: shown.department_id,
      label: `${shown.department_code} (no longer active)`,
      name: shown.department_name,
    });
  }

  // The revision whose files this form shows: an unfinished draft if there is one, otherwise the
  // revision in force. A draft's files can change directly; changing the files of the revision in
  // force makes the next revision.
  const draft = current?.draft_revision ?? null;
  const inForce = current?.current_revision ?? null;
  const base = draft ?? inForce;
  const existing = base?.files ?? [];
  const keptCount = existing.filter((f) => !removed.includes(f.file_id)).length;
  const totalFiles = keptCount + pending.length;
  const roomLeft = MAX_FILES - totalFiles;

  // What has been edited, compared with the revision the form started from
  const watched = Form.useWatch([], form) as Partial<FormValues> | undefined;
  const text = (v: string | undefined) => (v ?? '').trim();
  const detailChanges: string[] = [];
  if (base && watched) {
    if (text(watched.code) !== base.code) detailChanges.push(`Code changed from ${base.code} to ${text(watched.code)}`);
    if (text(watched.name) !== base.name) detailChanges.push(`Renamed to “${text(watched.name)}”`);
    if (watched.category_id !== undefined && watched.category_id !== base.category_id) {
      const to = categories.find((c) => c.category_id === watched.category_id)?.name_en ?? 'another category';
      detailChanges.push(`Category changed from ${base.category_name} to ${to}`);
    }
    if (watched.department_id !== undefined && watched.department_id !== base.department_id) {
      const to = departments.find((d) => d.department_id === watched.department_id)?.code ?? 'another department';
      detailChanges.push(`Department changed from ${base.department_code} to ${to}`);
    }
    if (text(watched.description) !== base.description) detailChanges.push('Description updated');
    const typeNow = watched.template_type ?? base.template_type;
    if (typeNow !== base.template_type) {
      detailChanges.push(typeNow === 'FLOW' ? 'Changed to a document that runs an approval flow' : 'Changed to a normal document');
    } else if (typeNow === 'FLOW' && (watched.approval_template_id ?? null) !== base.approval_template_id) {
      const to = approvalTemplates.find((a) => a.template_id === watched.approval_template_id)?.code ?? 'another template';
      detailChanges.push(`Approval template changed from ${base.approval_template_code || 'none'} to ${to}`);
    }
  }

  // ── Flow documents: the approval template and the signature layout ──
  const isFlow = (watched?.template_type ?? base?.template_type ?? 'NORMAL') === 'FLOW';
  const approvalId = isFlow ? (watched?.approval_template_id ?? null) : null;
  const approval = approvalTemplates.find((a) => a.template_id === approvalId) ?? null;
  // Whose signatures need a place: the issuer first, then each step of the approval template
  const signers: Signer[] = approval
    ? [
        { kind: 'ISSUER', stepNo: 0, label: 'Issued', detail: 'The person who issues the document' },
        ...approval.steps.map(
          (step): Signer => ({
            kind: 'STEP',
            stepNo: step.step_no,
            label: step.step_name,
            detail:
              step.approver_type === 'USER'
                ? describeApprovers(
                    step.approvers.map((a) => a.name),
                    step.approval_rule,
                  )
                : describeChosenLater(step.approval_rule),
          }),
        ),
        // Only some forms: one a supplier has to fill in and sign
        { kind: 'SUPPLIER', stepNo: 0, label: 'Supplier', detail: 'Only for a form a supplier fills in', fields: true, optional: true },
        // Stamped by itself when the last step passes
        { kind: 'SEAL', stepNo: 0, label: 'Company seal', detail: 'Stamped when the last step approves', seal: true, optional: true, imageUrl: sealUrl },
      ]
    : [];
  // The PDFs blocks can be placed on: those kept from the revision shown, and those waiting to be uploaded
  const pdfFiles: EditorFile[] = [
    ...existing
      .filter((f) => f.extension === 'pdf' && !removed.includes(f.file_id))
      .map((f) => ({
        key: savedFileKey(f.file_id),
        name: f.label || f.original_name,
        source: { url: documentTemplateFileUrl(current?.document_template_id ?? 0, f.file_id, true) },
      })),
    ...pending
      .filter((p) => fileExtension(p.file.name) === 'pdf')
      .map((p) => ({ key: pendingFileKey(p.key), name: p.label || p.file.name, source: { file: p.file } })),
  ];
  // Blocks that still make sense: on a PDF that is still there, for a signer of the chosen approval template
  const liveBlocks = isFlow
    ? blocks.filter((b) => pdfFiles.some((f) => f.key === b.fileKey) && signers.some((s) => signerKey(s) === signerKey(b)))
    : [];
  const layoutChanged = layoutSignature(liveBlocks) !== (base?.template_type === 'FLOW' ? layoutBaseline : '');
  if (base && layoutChanged && isFlow) detailChanges.push('Signature blocks rearranged');
  const relabelled = existing.filter(
    (f) => !removed.includes(f.file_id) && labels[f.file_id] !== undefined && labels[f.file_id].trim() !== f.label,
  );
  const filesChanged = removed.length > 0 || pending.length > 0;
  const changed = detailChanges.length > 0 || relabelled.length > 0 || filesChanged;

  // Everything in a published revision is fixed, so any change to it makes the next revision
  const startsRevision = draft === null && inForce !== null && changed;
  // Number of the revision this save will publish, or null when it publishes none
  const targetRevisionNo = draft ? draft.revision_no : startsRevision && inForce ? inForce.revision_no + 1 : !current ? 1 : null;
  // From Rev.02 on, a revision says what changed
  const needsSummary = targetRevisionNo !== null && targetRevisionNo > 1;

  // A change note written from the edits themselves, used when the user leaves the note blank
  const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.length} files`);
  const autoSummary = [
    ...detailChanges,
    ...(pending.length > 0 ? [`Added ${list(pending.map((p) => p.file.name))}`] : []),
    ...(removed.length > 0
      ? [`Removed ${list(existing.filter((f) => removed.includes(f.file_id)).map((f) => f.original_name))}`]
      : []),
    ...(relabelled.length > 0 ? [`Relabelled ${list(relabelled.map((f) => f.original_name))}`] : []),
  ].join('. ');

  const addFiles = (files: File[]) => {
    const problems: string[] = [];
    const accepted: PendingFile[] = [];
    let room = roomLeft;
    for (const file of files) {
      if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file.name))) {
        problems.push(`${file.name}: only PDF, Word and Excel files are accepted`);
      } else if (file.size === 0) {
        problems.push(`${file.name}: the file is empty`);
      } else if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name}: larger than ${formatFileSize(MAX_FILE_BYTES)}`);
      } else if (room <= 0) {
        problems.push(`${file.name}: a document can have at most ${MAX_FILES} files`);
      } else {
        room -= 1;
        nextKey.current += 1;
        accepted.push({ key: `new-${nextKey.current}`, file, label: '' });
      }
    }
    if (accepted.length > 0) setPending((list) => [...list, ...accepted]);
    if (problems.length > 0) {
      message.warning({
        duration: 6,
        content: (
          <span className="inline-block text-left">
            {problems.length === 1 ? 'A file was not added' : `${problems.length} files were not added`}
            {problems.slice(0, 4).map((p) => (
              <span key={p} className="block text-[12px] text-muted">
                {p}
              </span>
            ))}
          </span>
        ),
      });
    }
  };

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
    if (needsSummary && totalFiles === 0) {
      setErrorIsInput(true);
      setError('A revision needs at least one file. Keep or add a file, or delete the document instead.');
      return;
    }
    if (values.template_type === 'FLOW' && totalFiles > 0) {
      if (pdfFiles.length === 0) {
        setErrorIsInput(true);
        setError('A document that runs an approval flow needs at least one PDF file to sign on.');
        return;
      }
      if (liveBlocks.length === 0) {
        setErrorIsInput(true);
        setError('Place at least one signature block: open “Place signature blocks” and put each signer where they sign.');
        return;
      }
    }
    // Opened and saved without touching anything: there is no revision to make
    if (current && inForce && !draft && !changed) {
      onClose();
      return;
    }
    const input: DocumentTemplateInput = {
      code: values.code.trim(),
      name: values.name.trim(),
      description: (values.description ?? '').trim(),
      category_id: values.category_id as number,
      department_id: values.department_id as number,
      template_type: values.template_type,
      approval_template_id: values.template_type === 'FLOW' ? (values.approval_template_id ?? null) : null,
    };

    setError(null);
    setErrorIsInput(false);
    const wasEditing = current !== null;
    const failures: string[] = [];
    const reason = (err: unknown) => (err instanceof Error ? err.message : 'unknown error');
    const details = { change_summary: changeSummary.trim() || autoSummary, effective_date: '' };

    // 1. Get a draft revision to work in, and put the document details on it.
    //    Everything in a published revision is fixed, so a change to a published document starts
    //    the next revision: a draft that begins as a copy of the current one.
    setProgress('Saving…');
    let doc: DocumentTemplate;
    let working: DocumentTemplateRevision | null;
    let removeIds = removed;
    let labelEdits = labels;
    // Where each file the blocks refer to ends up on the server: saved files may be copied into a
    // new revision (new ids), and pending files get their ids when uploaded.
    const fileIdOf = new Map<string, number>(existing.map((f) => [savedFileKey(f.file_id), f.file_id]));
    try {
      if (!current) {
        doc = await createDocumentTemplate(input);
        working = doc.draft_revision;
      } else if (draft) {
        doc = await updateDocumentTemplate(current.document_template_id, input);
        working = doc.draft_revision;
        if (working && working.revision_no > 1) {
          await updateDocumentTemplateRevision(current.document_template_id, working.revision_id, details);
        }
      } else {
        setProgress('Starting the new revision…');
        working = await startDocumentTemplateRevision(current.document_template_id, details);
        // The draft's files are copies with new ids; carry the pending edits over to them.
        const copyOf = new Map(working.files.map((f) => [f.source_file_id, f.file_id]));
        for (const [oldId, newId] of copyOf) if (oldId !== null) fileIdOf.set(savedFileKey(oldId), newId);
        removeIds = removed.flatMap((old) => copyOf.get(old) ?? []);
        labelEdits = Object.fromEntries(
          Object.entries(labels).flatMap(([old, label]) => {
            const copy = copyOf.get(Number(old));
            return copy === undefined ? [] : [[copy, label]];
          }),
        );
        doc = current;
        if (detailChanges.length > 0) {
          try {
            doc = await updateDocumentTemplate(current.document_template_id, input);
          } catch (err) {
            failures.push(`The document details were not saved (${reason(err)}).`);
          }
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the document. Please try again.');
      setProgress(null);
      return;
    }
    setCurrent(doc);
    const id = doc.document_template_id;
    const targetFiles = working?.files ?? [];

    // 3. Files taken off the list (only ever from a draft)
    const stillRemoved: number[] = [];
    for (const fileId of removeIds) {
      try {
        await removeDocumentTemplateFile(id, fileId);
      } catch (err) {
        stillRemoved.push(fileId);
        failures.push(`A file could not be removed: ${reason(err)}.`);
      }
    }

    // 4. Labels that were changed
    const stillChanged: Record<number, string> = {};
    for (const file of targetFiles) {
      const label = labelEdits[file.file_id];
      if (label === undefined || label.trim() === file.label || removeIds.includes(file.file_id)) continue;
      try {
        await renameDocumentTemplateFile(id, file.file_id, label.trim());
      } catch (err) {
        stillChanged[file.file_id] = label;
        failures.push(`${file.original_name}: the label was not saved (${reason(err)}).`);
      }
    }

    // 5. New files, one at a time so a failure names the file it belongs to
    const notUploaded: PendingFile[] = [];
    for (const [i, item] of pending.entries()) {
      setProgress(`Uploading file ${i + 1} of ${pending.length}…`);
      try {
        const uploaded = await uploadDocumentTemplateFile(id, item.file, item.label.trim());
        fileIdOf.set(pendingFileKey(item.key), uploaded.file_id);
      } catch (err) {
        notUploaded.push({ ...item, error: reason(err) });
        failures.push(`${item.file.name}: ${reason(err)}.`);
      }
    }

    // 5b. The signature layout of a flow document, now that every file it refers to has an id.
    //     Sent whenever there is a draft to put it in: a new revision starts with the old layout
    //     and a changed approval template clears it, so the form's layout is always the one to keep.
    let layoutSaved = false;
    if (working && input.template_type === 'FLOW') {
      const layout: SignBlockInput[] = liveBlocks.flatMap((b) => {
        const fileId = fileIdOf.get(b.fileKey);
        return fileId === undefined
          ? [] // its file was not uploaded; the failure is already reported above
          : [{ file_id: fileId, signer_kind: b.signerKind, step_no: b.stepNo, content: b.content, label: b.field?.label.trim(), field_type: b.field?.type, field_required: b.field?.required, page_no: b.pageNo, x: b.x, y: b.y, width: b.width, height: b.height }];
      });
      try {
        await saveDocumentTemplateSignBlocks(id, layout);
        layoutSaved = true;
      } catch (err) {
        failures.push(`The signature blocks were not saved (${reason(err)}).`);
      }
    }

    // 6. Publish the draft once everything is in it. A first revision with no files yet simply stays a draft.
    let published: DocumentTemplate | null = null;
    const filesInDraft = targetFiles.length - (removeIds.length - stillRemoved.length) + (pending.length - notUploaded.length);
    if (working && failures.length === 0 && filesInDraft > 0) {
      setProgress('Publishing…');
      try {
        published = await publishDocumentTemplateRevision(id, working.revision_id);
      } catch (err) {
        failures.push(`${revisionLabel(working.revision_no)} could not be published (${reason(err)}).`);
      }
    }

    // 7. Read back what the server now holds, and re-key what is left to do against it
    let fresh = published ?? doc;
    if (!published) {
      try {
        fresh = await getDocumentTemplate(id);
      } catch {
        // The saves above succeeded; the list will show the document as it was until reloaded.
      }
    }
    setCurrent(fresh);
    setRemoved(stillRemoved);
    setLabels(stillChanged);
    setPending(notUploaded);
    if (layoutSaved) {
      // What is on the server is now what the form shows; blocks on files that failed to upload stay as they are
      const stored = initialBlocks(fresh);
      setBlocks([...stored, ...blocks.filter((b) => b.fileKey.startsWith('p:') && notUploaded.some((p) => pendingFileKey(p.key) === b.fileKey))]);
      setLayoutBaseline(layoutSignature(stored));
    }

    setProgress(null);
    if (failures.length === 0) {
      onSaved(fresh, wasEditing ? 'updated' : 'created');
      return;
    }
    const unfinished = fresh.draft_revision ? ` ${revisionLabel(fresh.draft_revision.revision_no)} is kept as a draft until this is sorted out.` : '';
    setError(`${fresh.code} was saved, but not everything went through. ${failures.join(' ')}${unfinished} Fix the problem and save again.`);
    onPartlySaved(fresh);
  };

  const discardDraft = async () => {
    if (!current || !draft) return;
    setError(null);
    setProgress('Discarding the draft…');
    try {
      await discardDocumentTemplateRevision(current.document_template_id, draft.revision_id);
      const fresh = await getDocumentTemplate(current.document_template_id);
      setCurrent(fresh);
      setRemoved([]);
      setLabels({});
      setPending([]);
      setBlocks(initialBlocks(fresh));
      setLayoutBaseline(layoutSignature(initialBlocks(fresh)));
      form.setFieldsValue(initialDetails(fresh));
      setChangeSummary('');
      onPartlySaved(fresh);
      message.success(`${revisionLabel(draft.revision_no)} draft discarded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not discard the draft.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow">Document Control</p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.018em]">
            {editing ? 'Edit Document Template' : 'New Document Template'}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted">
            One document code with the files that belong to it. Two things to fill in: the document, then its files.
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
      <div className="slim-scroll max-h-[min(66vh,660px)] overflow-y-auto px-6 py-5">
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          disabled={submitting}
          initialValues={initialDetails(template)}
        >
          {/* ── 1. The document ───────────────────────────── */}
          <SectionHeading number={1} title="Describe the document" hint="Its code, name, and where it belongs. Changing any of these later is kept as a new revision." />

          {optionsError && (
            <Alert
              type="warning"
              showIcon
              className="mb-3.5!"
              title="Categories and departments could not be loaded"
              description={`${optionsError} They cannot be chosen until they load.`}
            />
          )}

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[200px_1fr]">
            <Form.Item
              name="code"
              label="Document code"
              tooltip="The controlled document number, e.g. FM-QA-001. Letters, numbers and dashes; no spaces."
              normalize={(v: string) => v.toUpperCase()}
              rules={[
                { required: true, whitespace: true, message: 'Enter the document code' },
                { max: 50, message: 'Up to 50 characters' },
                { pattern: /^\S+$/, message: 'No spaces allowed' },
              ]}
            >
              <Input placeholder="e.g. FM-QA-001" maxLength={50} className="doc-code" />
            </Form.Item>
            <Form.Item
              name="name"
              label="Document name"
              rules={[
                { required: true, whitespace: true, message: 'Enter the document name' },
                { max: 200, message: 'Up to 200 characters' },
              ]}
            >
              <Input placeholder="e.g. Incoming inspection form" maxLength={200} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="category_id" label="Category" rules={[{ required: true, message: 'Choose a category' }]}>
              <Select loading={optionsLoading} placeholder="Choose, e.g. Form or Procedure" options={categoryOptions} />
            </Form.Item>
            <Form.Item name="department_id" label="Department"  rules={[{ required: true, message: 'Choose the owning department' }]}>
              <Select
                loading={optionsLoading}
                placeholder="Choose, e.g. QA or QC"
                options={departmentOptions}
                showSearch={{
                  filterOption: (input, option) => {
                    const o = option as { label?: string; name?: string } | undefined;
                    return `${o?.label ?? ''} ${o?.name ?? ''}`.toLowerCase().includes(input.trim().toLowerCase());
                  },
                }}
                optionRender={(option) => (
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink">{option.label}</span>
                    <span className="truncate text-[12px] text-muted">{(option.data as { name: string }).name}</span>
                  </span>
                )}
              />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={2} maxLength={500} showCount placeholder="What is this document used for?" />
          </Form.Item>

          <Form.Item
            name="template_type"
            label="How is this document used?"
            extra={
              <span className="text-[11.5px] text-faint">
                {isFlow
                  ? 'Approvers sign in turn, and each signature is placed in its box on the PDF automatically.'
                  : 'A document and its files, with no approval flow attached.'}
              </span>
            }
          >
            <Segmented block options={TEMPLATE_TYPES} aria-label="How this document is used" />
          </Form.Item>

          {isFlow && (
            <Form.Item
              name="approval_template_id"
              label="Approval template"
              rules={[{ required: true, message: 'Choose the approval template this document runs' }]}
              extra={
                <span className="text-[11.5px] text-faint">
                  Its steps decide who signs. Changing it clears the signature blocks, because they belong to the steps.
                </span>
              }
            >
              <Select
                loading={optionsLoading}
                placeholder="Choose who approves, e.g. Standard document approval"
                // The blocks were placed for the old template's steps; the backend drops them too
                onChange={() => setBlocks([])}
                showSearch={{
                  filterOption: (input, option) => String(option?.label ?? '').toLowerCase().includes(input.trim().toLowerCase()),
                }}
                options={[
                  ...approvalTemplates
                    .filter((a) => a.is_active)
                    .map((a) => ({ value: a.template_id, label: `${a.code} · ${a.name} (${a.step_count} ${a.step_count === 1 ? 'step' : 'steps'})` })),
                  // The one already on the document may since have been switched off or deleted; keep it readable
                  ...(shown?.approval_template_id && !approvalTemplates.some((a) => a.is_active && a.template_id === shown.approval_template_id)
                    ? [{ value: shown.approval_template_id, label: `${shown.approval_template_code} · ${shown.approval_template_name} (no longer available)` }]
                    : []),
                ]}
              />
            </Form.Item>
          )}
        </Form>

        {/* ── 2. The files ──────────────────────────────── */}
        <div className="border-t border-line pt-5">
          <SectionHeading
            number={2}
            title="Add the files"
            hint="A document can come as a set. Add every file that is used or signed together, such as a form and its attachment. Each change is kept as a revision."
          />

          {/* Shown only once there is something to record: a change that will become the next
              revision, or a draft revision that was left unfinished. */}
          {(startsRevision || (draft !== null && draft.revision_no > 1)) && (
            <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3">
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2">
                <GitBranch size={14} className="mt-0.75 shrink-0 text-brand-500" />
                <span>
                  {draft ? (
                    <>
                      <b className="font-semibold text-ink">{revisionLabel(draft.revision_no)}</b> is a draft that was not finished.
                      {inForce && <> {revisionLabel(inForce.revision_no)} stays in force until this one is saved.</>}
                    </>
                  ) : inForce ? (
                    <>
                      Saving will create <b className="font-semibold text-ink">{revisionLabel(inForce.revision_no + 1)}</b>.{' '}
                      {revisionLabel(inForce.revision_no)} is kept in the history with the values and files it has now.
                    </>
                  ) : null}
                </span>
              </p>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
                  What changed in {revisionLabel(targetRevisionNo ?? 0)}?
                </span>
                <Input.TextArea
                  rows={2}
                  maxLength={500}
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  disabled={submitting}
                  placeholder={autoSummary || 'e.g. Replaced the signature sheet with the 2026 layout'}
                  aria-label="What changed in this revision"
                />
                <span className="mt-1 block text-[11.5px] text-faint">
                  Leave blank to record the changes automatically{autoSummary ? ', as shown above.' : '.'} The revision is dated
                  today.
                </span>
              </label>

              {draft && (
                <button
                  type="button"
                  onClick={() => void discardDraft()}
                  disabled={submitting}
                  className="mt-2.5 text-[12px] font-medium text-danger-strong underline decoration-danger-ring underline-offset-2 hover:decoration-danger-strong disabled:opacity-60"
                >
                  Discard this draft and keep {inForce ? revisionLabel(inForce.revision_no) : 'the current revision'}
                </button>
              )}
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            aria-label="Add files"
            aria-disabled={submitting || roomLeft <= 0}
            onClick={() => !submitting && roomLeft > 0 && fileInput.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !submitting && roomLeft > 0) {
                e.preventDefault();
                fileInput.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!submitting && roomLeft > 0) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!submitting) addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              'flex flex-col items-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
              submitting || roomLeft <= 0
                ? 'cursor-not-allowed border-line bg-[#FAFAFB] opacity-60'
                : 'cursor-pointer border-[#D4D4D8] bg-[#FAFAFB] hover:border-brand-300 hover:bg-brand-50',
              dragging && 'border-brand-400 bg-brand-50',
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-brand-500">
              <UploadCloud size={17} strokeWidth={1.85} />
            </span>
            <p className="mt-2.5 text-[13px] font-medium text-ink">
              {roomLeft <= 0 ? (
                `This document already has ${MAX_FILES} files`
              ) : (
                <>
                  Drop files here, or <span className="text-brand-600 underline decoration-brand-200 underline-offset-2">browse</span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              PDF, Word, Excel · up to {formatFileSize(MAX_FILE_BYTES)} each · up to {MAX_FILES} files
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = ''; // so choosing the same file again fires a change
              }}
            />
          </div>

          {totalFiles === 0 && removed.length === 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
              <Info size={13} className="shrink-0 text-faint" />
              No files yet. You can save now and add the files later.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2" aria-label="Files">
              {existing.map((file) => {
                const gone = removed.includes(file.file_id);
                return (
                  <li
                    key={file.file_id}
                    className={cn('flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5', gone && 'bg-[#FAFAFB]')}
                  >
                    <FileChip extension={file.extension} />
                    <div className={cn('min-w-0 flex-1', gone && 'opacity-50')}>
                      <Input
                        size="small"
                        variant="borderless"
                        value={labels[file.file_id] ?? file.label}
                        onChange={(e) => setLabels((all) => ({ ...all, [file.file_id]: e.target.value }))}
                        disabled={gone || submitting}
                        maxLength={200}
                        placeholder={LABEL_PLACEHOLDER}
                        aria-label={`Label for ${file.original_name}`}
                        className="-ml-1.75! text-[13px]! font-medium!"
                      />
                      <p className={cn('truncate text-[11.5px] text-muted', gone && 'line-through')}>
                        {file.original_name} · {formatFileSize(file.size_bytes)}
                      </p>
                    </div>
                    {gone ? (
                      <button
                        type="button"
                        onClick={() => setRemoved((ids) => ids.filter((id) => id !== file.file_id))}
                        disabled={submitting}
                        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-brand-600 transition-colors hover:bg-brand-50"
                      >
                        <RotateCcw size={13} />
                        Keep
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Tooltip title="Download">
                          <a
                            href={documentTemplateFileUrl(current?.document_template_id ?? 0, file.file_id)}
                            aria-label={`Download ${file.original_name}`}
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
                          >
                            <Download size={15} />
                          </a>
                        </Tooltip>
                        <Tooltip title="Leave out of the next save">
                          <button
                            type="button"
                            onClick={() => setRemoved((ids) => [...ids, file.file_id])}
                            disabled={submitting}
                            aria-label={`Remove ${file.original_name}`}
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
                          >
                            <Trash2 size={15} />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                    {gone && <span className="sr-only">Will be removed when saved</span>}
                  </li>
                );
              })}

              {pending.map((item) => (
                <li
                  key={item.key}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                    item.error ? 'border-danger-ring bg-danger-soft' : 'border-brand-200 bg-brand-50/50',
                  )}
                >
                  <FileChip extension={fileExtension(item.file.name)} />
                  <div className="min-w-0 flex-1">
                    <Input
                      size="small"
                      variant="borderless"
                      value={item.label}
                      onChange={(e) =>
                        setPending((list) => list.map((p) => (p.key === item.key ? { ...p, label: e.target.value } : p)))
                      }
                      disabled={submitting}
                      maxLength={200}
                      placeholder={LABEL_PLACEHOLDER}
                      aria-label={`Label for ${item.file.name}`}
                      className="-ml-1.75! text-[13px]! font-medium!"
                    />
                    <p className="truncate text-[11.5px] text-muted">
                      {item.file.name} · {formatFileSize(item.file.size)}
                      {item.error ? (
                        <span className="font-medium text-danger-strong"> · Not uploaded: {item.error}</span>
                      ) : (
                        <span className="font-medium text-brand-600"> · New</span>
                      )}
                    </p>
                  </div>
                  <Tooltip title="Don't add this file">
                    <button
                      type="button"
                      onClick={() => setPending((list) => list.filter((p) => p.key !== item.key))}
                      disabled={submitting}
                      aria-label={`Don't add ${item.file.name}`}
                      className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
                    >
                      <X size={15} />
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}

          {removed.length > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              {removed.length === 1 ? '1 file' : `${removed.length} files`} will be left out when you save.
              {inForce && !draft ? ` They stay available in ${revisionLabel(inForce.revision_no)}.` : ''}
            </p>
          )}
        </div>

        {/* ── 3. The signature blocks (flow documents) ──── */}
        {isFlow && (
          <div className="mt-5 border-t border-line pt-5">
            <SectionHeading
              number={3}
              title="Place the signature blocks"
              hint="Mark the empty boxes printed in the document, one for each person who signs. When the document is approved, each signature goes into its box by itself."
            />

            {!approval ? (
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Info size={13} className="shrink-0 text-faint" />
                Choose an approval template above first; its steps are the people who sign.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5" aria-label="Signers and their blocks">
                  {signers.map((signer, i) => {
                    const own = liveBlocks.filter((b) => signerKey(b) === signerKey(signer));
                    const count = own.filter((b) => b.content === 'SIGNATURE').length;
                    const dates = own.filter((b) => b.content === 'DATE').length;
                    const typed = own.filter((b) => b.content === 'FIELD').length;
                    return (
                      <li key={signerKey(signer)} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: signerColor(i).border }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {signer.kind === 'STEP' && <span className="tnum text-muted">{signer.stepNo}. </span>}
                            {signer.label}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted">{signer.detail}</span>
                        </span>
                        <span className={cn('tnum shrink-0 text-[12px]', count === 0 && !signer.optional ? 'font-medium text-[#A16207]' : 'text-muted')}>
                          {signer.seal
                            ? own.length === 0
                              ? 'Not used'
                              : `${own.length} ${own.length === 1 ? 'place' : 'places'}`
                            : count === 0
                              ? signer.optional
                                ? 'Not used'
                                : 'Not placed'
                              : `${count} ${count === 1 ? 'signature' : 'signatures'}`}
                          {dates > 0 && ` · ${dates} ${dates === 1 ? 'date' : 'dates'}`}
                          {typed > 0 && ` · ${typed} ${typed === 1 ? 'field' : 'fields'}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    disabled={pdfFiles.length === 0 || submitting}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <PenTool size={14} />
                    {liveBlocks.length === 0 ? 'Place signature blocks' : 'Change signature blocks'}
                  </button>
                  {pdfFiles.length === 0 && (
                    <span className="text-[12px] text-[#A16207]">Add a PDF file above first: signatures are placed on PDF pages.</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <SignBlockEditor
          open={editorOpen}
          files={pdfFiles}
          signers={signers}
          blocks={liveBlocks}
          onClose={() => setEditorOpen(false)}
          onSave={(next) => {
            setBlocks(next);
            setEditorOpen(false);
          }}
        />

        <div ref={errorBox}>
          {error && (
            <Alert
              type="error"
              showIcon
              className="mt-5!"
              title={errorIsInput ? 'One more thing before saving' : 'Not everything was saved'}
              description={error}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAFB] px-6 py-4">
        <p className="tnum flex items-center gap-1.5 text-[12px] text-muted">
          <Info size={13} className="text-faint" />
          {totalFiles} of {MAX_FILES} files
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink disabled:opacity-60"
          >
            {current && !template ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {progress ?? (editing ? 'Save Changes' : 'Create Document')}
          </button>
        </div>
      </div>
    </>
  );
}

/** Numbered heading that splits the form into the things to do, in order. */
function SectionHeading({ number, title, hint }: { number: number; title: string; hint: string }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5">
      <span className="tnum mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-[11px] font-semibold text-brand-700">
        {number}
      </span>
      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{hint}</p>
      </div>
    </div>
  );
}
