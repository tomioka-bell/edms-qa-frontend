import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App as AntApp, DatePicker, Input, InputNumber, Popconfirm, Segmented, Select, Spin, Tooltip } from 'antd';
import { ArrowLeft, Download, Eye, FileStack, FileUp, PencilLine, Info, Plus, RefreshCw, Send, ServerCrash, Signature, Trash2, Undo2, Workflow, Stamp } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';
import FileChip from '../../components/documentTemplates/FileChip';
import ApproverSelect from '../../components/requests/ApproverSelect';
import RequestPreviewModal from '../../components/requests/RequestPreviewModal';
import SupplierSection from '../../components/requests/SupplierSection';
import RequestStatusTag, { DocTypeTag } from '../../components/requests/RequestStatusTag';
import SignBlockEditor from '../../components/signBlocks/SignBlockEditor';
import sealUrl from '../../e-signature/Seal.png';
import type { EditableBlock } from '../../components/signBlocks/types';
import { ApiError } from '../../lib/api';
import { getMySignature } from '../../lib/signature';
import { listActiveStepTypes, listApprovalTemplates, listApproverCandidates } from '../../lib/approvalTemplates';
import {
  cancelDocumentRequest,
  deleteDocumentRequest,
  documentRequestFileUrl,
  getDocumentRequest,
  moveToLatestRevision,
  removeDocumentRequestFile,
  saveIssuerSignBlocks,
  saveDocumentRequestRoute,
  submitDocumentRequest,
  updateDocumentRequest,
  uploadDocumentRequestFile,
  saveSealBlocks,
} from '../../lib/documentRequests';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, MAX_FILES, fileExtension, formatFileSize, revisionLabel } from '../../lib/documentTemplates';
import type { ApprovalRule, ApprovalStepType, ApprovalTemplate, DirectoryUser } from '../../types/approval';
import type { DocumentRequest, RequestRouteStepInput } from '../../types/documentRequest';
import type { BlockContent } from '../../types/documentTemplate';
import { useInboxStore } from '../../stores/inbox';
import { useCurrentUser } from '../../stores/session';
import { dayjs } from '../../lib/format';
import { describeLimit } from '../../lib/deadlines';
import { cn } from '../../lib/cn';

const MAX_STEPS = 10;

const fileKey = (fileId: number) => `f:${fileId}`;

const MY_SIGNATURE_TEXT = {
  eyebrow: 'Your signature',
  title: 'Place your signature',
  hint: 'Add your signature, drag it to where you sign, and pull its corner to size it. If the form has a box for the date, add a date there too.',
  confirm: 'Save places',
};

const SEAL_TEXT = {
  eyebrow: 'Company seal',
  title: 'Place the company seal',
  hint: 'Add the seal and drag it to where the form has room for it. It is stamped by itself when the last approval step passes.',
  confirm: 'Save places',
};

const RULES: Array<{ value: ApprovalRule; label: string }> = [
  { value: 'ANY_ONE', label: 'Any one approves' },
  { value: 'ALL', label: 'All must approve' },
];

/** One step of the route as it is being edited. With an approval template only `approverIds` can change. */
interface StepDraft {
  key: number;
  stepTypeId: number | null;
  rule: ApprovalRule;
  approverIds: number[];
  /** Days the step's approvers have to decide; 0 for no limit */
  dueDays: number;
}

let nextStepKey = 1;

const draftsOf = (request: DocumentRequest): StepDraft[] =>
  request.steps.map((s) => ({
    key: nextStepKey++,
    stepTypeId: s.step_type_id,
    rule: s.approval_rule,
    approverIds: s.approvers.map((a) => a.user_id),
    dueDays: s.due_days,
  }));

/** What saving the route would send, in the shape the backend takes for this request. */
function routePayload(request: DocumentRequest, drafts: StepDraft[]): RequestRouteStepInput[] {
  if (request.approval_template_id !== null) {
    return request.steps.map((step, i) => ({
      approver_user_ids: step.approver_type === 'REQUESTER_SELECT' ? (drafts[i]?.approverIds ?? []) : [],
    }));
  }
  return drafts.map((d) => ({
    step_type_id: d.stepTypeId,
    approval_rule: d.approverIds.length > 1 ? d.rule : 'ANY_ONE',
    approver_user_ids: d.approverIds,
    due_days: d.dueDays,
  }));
}

function SectionHeading({ number, title, hint }: { number: number; title: string; hint: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[12px] font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{hint}</p>
      </div>
    </div>
  );
}

/** Puts a draft (or a returned request) together and sends it for approval: details, files, approvers. */
export default function RequestEditorPage() {
  const { id } = useParams();
  const requestId = Number(id);
  const validId = Number.isInteger(requestId) && requestId > 0;
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // The last day the document is valid, as YYYY-MM-DD; empty when it does not expire
  const [validUntil, setValidUntil] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [stepTypes, setStepTypes] = useState<ApprovalStepType[]>([]);
  const [approvalTemplates, setApprovalTemplates] = useState<ApprovalTemplate[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [busy, setBusy] = useState<null | 'save' | 'send' | 'file' | 'route' | 'leave' | 'revision' | 'signature'>(null);
  // A normal document: the requester choosing where their own signature goes
  const [placingMine, setPlacingMine] = useState(false);
  // A normal document: the requester choosing where the company seal goes
  const [placingSeal, setPlacingSeal] = useState(false);
  // The reader's own signature picture, shown in the blocks they place; undefined until loaded or when they have none
  const [mySignatureUrl, setMySignatureUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getMySignature()
      .then((signature) => {
        if (!cancelled) setMySignatureUrl(signature?.image_url);
      })
      .catch(() => undefined); // the blocks then show as plain boxes
    return () => {
      cancelled = true;
    };
  }, []);
  const { name: myName } = useCurrentUser();
  const [problems, setProblems] = useState<string[]>([]);
  // Set once Send has been tried, so empty steps are only marked after the user has had a go
  const [checked, setChecked] = useState(false);

  // The file being looked at in the preview; null when the preview is closed
  const [previewing, setPreviewing] = useState<number | null>(null);
  // The documents as they were sent in the round that came back
  const [sentBackShown, setSentBackShown] = useState(false);

  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<number | null>(null);

  /** Takes a request from the server as the new starting point, local edits included. */
  const adopt = (next: DocumentRequest) => {
    setRequest(next);
    setTitle(next.title);
    setDescription(next.description);
    setValidUntil(next.valid_until ?? '');
    setSteps(draftsOf(next));
  };

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    getDocumentRequest(requestId)
      .then((r) => {
        if (!cancelled) adopt(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'The request could not be loaded.'));
      });
    Promise.all([listApproverCandidates(), listActiveStepTypes(), listApprovalTemplates()])
      .then(([people, types, templates]) => {
        if (cancelled) return;
        setUsers(people);
        setStepTypes(types);
        setApprovalTemplates(templates.filter((t) => t.is_active));
      })
      .catch(() => undefined) // the pickers stay empty; saving reports what is missing
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, validId]);

  const failure = validId ? loadError : new ApiError(404, 'document request not found');
  if (failure) {
    return (
      <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
        <div className="panel">
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title={failure.status === 404 ? 'This request does not exist' : 'The request could not be loaded'}
            description={failure.status === 404 ? 'It may have been deleted, or the link is wrong.' : failure.message}
            action={
              <Link to="/my-documents" className="rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! hover:bg-brand-600!">
                Go to My Documents
              </Link>
            }
          />
        </div>
      </div>
    );
  }
  if (!request) {
    return (
      <div className="grid h-80 place-items-center">
        <Spin />
      </div>
    );
  }

  const isFlow = request.doc_type === 'FLOW';
  const usesTemplate = request.approval_template_id !== null;
  const returned = request.status === 'RETURNED';
  const editable = request.viewer.can_edit;
  // What brought it back, most recent first: an approver's send-back, or the requester taking it back
  const cameBack = returned
    ? [...request.history].reverse().find((h) => h.action === 'REJECT' || h.action === 'RECALL' || h.action === 'SUPPLIER_RETURN')
    : undefined;
  const sendBack = cameBack?.action === 'REJECT' || cameBack?.action === 'SUPPLIER_RETURN' ? cameBack : undefined;
  const newerRevision = request.template_latest_revision_no > request.revision_no ? request.template_latest_revision_no : 0;
  const working = busy !== null;

  // ---------- details and route ----------

  /** Saves the title, note and route if they differ from what the server has, and returns the request as it then stands. */
  const saveAll = async (): Promise<DocumentRequest> => {
    let latest = request;
    if (title.trim() !== request.title || description.trim() !== request.description || validUntil !== (request.valid_until ?? '')) {
      latest = await updateDocumentRequest(request.request_id, { title: title.trim(), description: description.trim(), valid_until: validUntil });
    }
    const wanted = routePayload(request, steps);
    if (JSON.stringify(wanted) !== JSON.stringify(routePayload(request, draftsOf(request)))) {
      latest = await saveDocumentRequestRoute(request.request_id, wanted);
    }
    return latest;
  };

  /** What stops the request from being saved (always) or sent (when `sending`). */
  const findProblems = (sending: boolean): string[] => {
    const found: string[] = [];
    if (!title.trim()) found.push('Give the document a title.');
    if (!usesTemplate) {
      steps.forEach((s, i) => {
        if (s.stepTypeId === null) found.push(`Step ${i + 1}: choose what the step is (for example Review or Approve).`);
      });
    }
    if (sending) {
      if (request.files.length === 0) found.push('Add at least one file.');
      if (steps.length === 0) found.push('Set who approves: choose an approval template or add a step.');
      steps.forEach((s, i) => {
        if (s.approverIds.length === 0) found.push(`Step ${i + 1}${request.steps[i] && usesTemplate ? ` (${request.steps[i].step_name})` : ''}: choose at least one approver.`);
      });
    }
    return found;
  };

  const run = async (kind: 'save' | 'send') => {
    const found = findProblems(kind === 'send');
    setChecked(kind === 'send');
    setProblems(found);
    if (found.length > 0) return;

    setBusy(kind);
    try {
      const saved = await saveAll();
      if (kind === 'save') {
        adopt(saved);
        message.success('Draft saved.');
        return;
      }
      const sent = await submitDocumentRequest(request.request_id);
      message.success(`${sent.request_no} was sent for approval.`);
      void useInboxStore.getState().refresh(); // the sender may be one of the approvers, and a returned document just left the list
      navigate('/my-documents');
    } catch (err) {
      setProblems([err instanceof ApiError ? err.message : 'Something went wrong. Please try again.']);
      // Part of it may have been saved: show what the server has now, but keep what was typed
      void getDocumentRequest(request.request_id)
        .then(setRequest)
        .catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const changeApprovalTemplate = async (templateId: number | undefined) => {
    setBusy('route');
    setProblems([]);
    try {
      const next = await updateDocumentRequest(request.request_id, { approval_template_id: templateId ?? 0 });
      setRequest(next);
      setSteps(draftsOf(next));
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The approval template could not be changed.');
    } finally {
      setBusy(null);
    }
  };

  /** Moves the request onto the form now in force. What was typed for the title and note is kept. */
  const switchToNewerRevision = async () => {
    setBusy('revision');
    setProblems([]);
    try {
      const next = await moveToLatestRevision(request.request_id);
      setRequest(next);
      setSteps(draftsOf(next));
      message.success(`Now on ${next.doc_code} ${revisionLabel(next.revision_no)}.`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The request could not be moved to the new revision.');
    } finally {
      setBusy(null);
    }
  };

  // ---------- the requester's own signature (normal documents) ----------

  const pdfFiles = request.files.filter((f) => fileExtension(f.original_name) === 'pdf');
  const myBlocks = request.sign_blocks.filter((b) => b.signer_kind === 'ISSUER');
  const mySignatures = myBlocks.filter((b) => b.content !== 'DATE').length;
  const myDates = myBlocks.length - mySignatures;

  // ---------- the company seal (normal documents; a flow document has it from its template) ----------

  const sealBlocks = request.sign_blocks.filter((b) => b.signer_kind === 'SEAL');

  const saveSealPlaces = async (blocks: EditableBlock[]) => {
    setBusy('signature');
    try {
      const next = await saveSealBlocks(
        request.request_id,
        blocks.map((b) => ({ file_id: Number(b.fileKey.slice(2)), content: 'SIGNATURE', page_no: b.pageNo, x: b.x, y: b.y, width: b.width, height: b.height })),
      );
      setRequest(next);
      setPlacingSeal(false);
      message.success(blocks.length === 0 ? 'The seal was taken off the document.' : 'The seal will be stamped when the last step approves.');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The seal places could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  /** Saves the places at once, like a file: they are part of the draft, not of what is typed. */
  const saveMyPlaces = async (blocks: EditableBlock[]) => {
    if (blocks.length > 0 && !blocks.some((b) => b.content === 'SIGNATURE')) {
      message.warning('Add a signature block as well: a date alone does not sign the document.');
      return;
    }
    setBusy('signature');
    try {
      const next = await saveIssuerSignBlocks(
        request.request_id,
        blocks.map((b) => ({ file_id: Number(b.fileKey.slice(2)), content: b.content as BlockContent, page_no: b.pageNo, x: b.x, y: b.y, width: b.width, height: b.height })),
      );
      setRequest(next); // what is typed for the title and route is kept
      setPlacingMine(false);
      message.success(blocks.length === 0 ? 'Your signature was taken off the document.' : 'Your signature will be placed when you send the document.');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Your signature places could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const patchStep = (key: number, patch: Partial<StepDraft>) => {
    setSteps((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setProblems([]); // the list was about the route as it was
  };
  const takenElsewhere = (key: number) => new Set(steps.filter((s) => s.key !== key).flatMap((s) => s.approverIds));
  const knownPeople = request.steps.flatMap((s) => s.approvers.map((a) => ({ user_id: a.user_id, name: a.name })));

  // ---------- files ----------

  const refreshFiles = async () => {
    const latest = await getDocumentRequest(request.request_id);
    setRequest(latest); // local edits to the title and route are kept
  };

  const upload = async (files: File[], replaces?: number) => {
    const rejected: string[] = [];
    const accepted = files.filter((file) => {
      const ext = fileExtension(file.name);
      if (isFlow ? ext !== 'pdf' : !ACCEPTED_EXTENSIONS.includes(ext)) {
        rejected.push(`${file.name}: ${isFlow ? 'a flow document takes PDF files only' : 'only PDF, Word and Excel files are accepted'}`);
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name}: larger than ${formatFileSize(MAX_FILE_BYTES)}`);
        return false;
      }
      return true;
    });

    setBusy('file');
    try {
      for (const file of accepted) {
        try {
          await uploadDocumentRequestFile(request.request_id, file, replaces);
        } catch (err) {
          rejected.push(`${file.name}: ${err instanceof ApiError ? err.message : 'upload failed'}`);
        }
      }
      await refreshFiles().catch(() => undefined);
    } finally {
      setBusy(null);
    }
    if (rejected.length > 0) message.error(rejected.join(' · '), 6);
    else if (accepted.length > 0) setProblems([]);
    if (rejected.length === 0 && accepted.length > 0) message.success(replaces ? 'File replaced.' : `${accepted.length} ${accepted.length === 1 ? 'file' : 'files'} added.`);
  };

  const removeFile = async (fileId: number) => {
    setBusy('file');
    try {
      await removeDocumentRequestFile(request.request_id, fileId);
      await refreshFiles();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'The file could not be removed.');
    } finally {
      setBusy(null);
    }
  };

  // ---------- leaving ----------

  const discard = async () => {
    setBusy('leave');
    try {
      if (request.round === 0) {
        await deleteDocumentRequest(request.request_id);
        message.success('Draft deleted.');
      } else {
        await cancelDocumentRequest(request.request_id);
        message.success(`${request.request_no} was cancelled.`);
        void useInboxStore.getState().refresh();
      }
      navigate('/my-documents');
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(null);
    }
  };

  const outlineButton =
    'flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-50';
  const smallButton =
    'flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-50';

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <Link to="/my-documents" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted! transition-colors hover:text-ink!">
        <ArrowLeft size={14} />
        My Documents
      </Link>

      <header className="mt-3 border-b border-line pb-5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="doc-code text-brand-600">{request.request_no}</span>
          <RequestStatusTag status={request.status} />
          <DocTypeTag type={request.doc_type} />
          {request.doc_code && (
            <span className="text-[12px] text-muted">
              from <span className="doc-code text-ink-2">{request.doc_code}</span> {revisionLabel(request.revision_no)}
            </span>
          )}
        </p>
        <h1 className="mt-2 text-[24px] leading-tight font-semibold tracking-[-0.022em] sm:text-[28px]">{title.trim() || request.title}</h1>
      </header>

      {!editable ? (
        <div className="panel mt-6">
          <EmptyState
            icon={<Send size={19} strokeWidth={1.75} />}
            title="This request has been sent"
            description="It can no longer be changed here. Follow its progress in My Documents."
            action={
              <Link to="/my-documents" className="rounded-lg bg-brand-500! px-3.5 py-2 text-[13px] font-semibold text-white! hover:bg-brand-600!">
                Go to My Documents
              </Link>
            }
          />
        </div>
      ) : (
        <div className="anim-rise mx-auto mt-6 flex max-w-4xl flex-col gap-5">
          {sendBack && (
            <Alert
              type="warning"
              showIcon
              icon={<Undo2 size={16} />}
              title={`Sent back by ${sendBack.actor_name || sendBack.actor_code} on ${dayjs(sendBack.created_at).format('DD MMM YYYY')}`}
              description={
                <>
                  <span className="block text-ink-2">“{sendBack.comment}”</span>
                  <span className="mt-1 block text-[12px] text-muted">Fix what is asked, then send it again. Approval starts over from the first step.</span>
                  {request.rounds.some((r) => r.round === request.round) && (
                    <button
                      type="button"
                      onClick={() => setSentBackShown(true)}
                      className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Eye size={13} />
                      See the version that was sent back
                    </button>
                  )}
                </>
              }
            />
          )}
          {cameBack?.action === 'RECALL' && (
            <Alert
              type="info"
              showIcon
              icon={<PencilLine size={16} />}
              title="You took this document back to change it"
              description="The approvers no longer see it. Make your changes, then send it again; approval starts over from the first step."
            />
          )}
          {newerRevision > 0 && (
            <Alert
              type="info"
              showIcon
              icon={<FileStack size={16} />}
              title={`${request.doc_code} has a newer form: ${revisionLabel(newerRevision)}`}
              description={
                <>
                  <span className="block">
                    This document was started from {revisionLabel(request.revision_no)}. You can keep it on that form, or move it to the one now in force.
                  </span>
                  <Popconfirm
                    title={`Move to ${revisionLabel(newerRevision)}?`}
                    description={
                      <span className="block max-w-72">
                        The files are replaced with those of {revisionLabel(newerRevision)}
                        {isFlow ? ', and its signature places and approvers are used' : ''}. A filled-in copy you put in place of a template file is taken
                        out: add it again on the new form.
                      </span>
                    }
                    okText={`Move to ${revisionLabel(newerRevision)}`}
                    cancelText="Keep this form"
                    onConfirm={() => void switchToNewerRevision()}
                  >
                    <button
                      type="button"
                      disabled={working}
                      className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                    >
                      <FileStack size={13} />
                      {busy === 'revision' ? 'Moving…' : `Update to ${revisionLabel(newerRevision)}`}
                    </button>
                  </Popconfirm>
                </>
              }
            />
          )}
          {request.viewer.needs_signature && (
            <Alert
              type="warning"
              showIcon
              icon={<Signature size={16} />}
              title="Set up your signature before sending"
              description={
                <>
                  {isFlow ? 'This document is signed by the person who issues it' : 'You chose to sign this document'}, and you have no signature on file yet.{' '}
                  <Link to="/my-signature" className="font-semibold text-brand-600! underline">
                    Open My Signature
                  </Link>
                  , save one, then come back.
                </>
              }
            />
          )}

          {/* 1. Details */}
          <section className="panel px-5 py-5 sm:px-6" aria-label="Details">
            <SectionHeading number={1} title="Details" hint="What approvers see first." />
            <div className="mt-4 sm:pl-9">
              <label htmlFor="editor-title" className="block text-[13px] font-medium text-ink-2">
                Title
              </label>
              <Input id="editor-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} status={checked && !title.trim() ? 'error' : undefined} className="mt-1.5" />
              <label htmlFor="editor-description" className="mt-4 block text-[13px] font-medium text-ink-2">
                Note to approvers <span className="font-normal text-muted">(optional)</span>
              </label>
              <Input.TextArea
                id="editor-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={1000}
                showCount
                placeholder="Anything they should know before deciding"
                className="mt-1.5"
              />
              <label htmlFor="editor-valid-until" className="mt-4 block text-[13px] font-medium text-ink-2">
                Valid until <span className="font-normal text-muted">(optional)</span>
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <DatePicker
                  id="editor-valid-until"
                  value={validUntil ? dayjs(validUntil) : null}
                  onChange={(day) => setValidUntil(day ? day.format('YYYY-MM-DD') : '')}
                  // A document cannot be made valid until a day that is already over
                  disabledDate={(day) => day.isBefore(dayjs(), 'day')}
                  format="DD MMM YYYY"
                  placeholder="No expiry"
                  allowClear
                  className="w-48!"
                />
                <p className="text-[12px] text-muted">
                  {validUntil
                    ? `Valid through ${dayjs(validUntil).format('DD MMM YYYY')} (${dayjs(validUntil).endOf('day').fromNow(true)} from now). It shows under Expiring Documents before then.`
                    : 'Leave empty for a document that does not expire.'}
                </p>
              </div>
            </div>
          </section>

          {/* 2. Files */}
          <section className="panel px-5 py-5 sm:px-6" aria-label="Files">
            <SectionHeading
              number={2}
              title="Files"
              hint={
                isFlow
                  ? 'These are the template’s files. Replace each with your filled-in PDF; a file is saved the moment you choose it.'
                  : `PDF, Word or Excel, up to ${formatFileSize(MAX_FILE_BYTES)} each. A file is saved the moment you add it.`
              }
            />
            <div className="mt-4 sm:pl-9">
              {isFlow && request.sign_blocks.length > 0 && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
                  <Info size={14} className="mt-0.5 shrink-0 text-brand-500" />
                  <span>
                    {request.sign_blocks.length} signature {request.sign_blocks.length === 1 ? 'place is' : 'places are'} already marked on{' '}
                    {request.files.length === 1 ? 'this file' : 'these files'}. Keep the same page layout in your filled-in copy, so each signature lands in
                    its box.
                  </span>
                </p>
              )}

              {request.files.length > 0 && (
                <ul className="flex flex-col gap-2" aria-label="Files of this request">
                  {request.files.map((file) => {
                    const ext = fileExtension(file.original_name);
                    return (
                      <li key={file.file_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                        <FileChip extension={ext} />
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setPreviewing(file.file_id)}
                            className="block max-w-full truncate text-left text-[13px] font-medium text-ink hover:text-brand-600 hover:underline"
                            title={`Preview ${file.original_name}`}
                          >
                            {file.original_name}
                          </button>
                          <p className="tnum truncate text-[11.5px] text-muted">
                            {file.label ? `${file.label} · ` : ''}
                            {formatFileSize(file.size_bytes)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => setPreviewing(file.file_id)} aria-label={`Preview ${file.original_name}`} className={smallButton}>
                            <Eye size={12} />
                            Preview
                          </button>
                          <Tooltip title="Download">
                            <a
                              href={documentRequestFileUrl(request.request_id, file.file_id)}
                              aria-label={`Download ${file.original_name}`}
                              className="rounded-md p-1.5 text-muted! transition-colors hover:bg-[#F4F4F5] hover:text-ink!"
                            >
                              <Download size={15} />
                            </a>
                          </Tooltip>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => {
                              replaceTarget.current = file.file_id;
                              replaceInput.current?.click();
                            }}
                            aria-label={`Replace ${file.original_name}`}
                            className={smallButton}
                          >
                            <RefreshCw size={12} />
                            {isFlow ? 'Replace with filled-in PDF' : 'Replace'}
                          </button>
                          {!isFlow && (
                            <Popconfirm title="Remove this file?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => void removeFile(file.file_id)}>
                              <button
                                type="button"
                                disabled={working}
                                aria-label={`Remove ${file.original_name}`}
                                className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            </Popconfirm>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isFlow && request.files.length < MAX_FILES && (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => addInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!working) void upload(Array.from(e.dataTransfer.files).slice(0, MAX_FILES - request.files.length));
                  }}
                  className={cn(
                    'flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/50 disabled:pointer-events-none disabled:opacity-60',
                    request.files.length > 0 && 'mt-3',
                    checked && request.files.length === 0 ? 'border-danger-ring bg-danger-soft/40' : 'border-[#D4D4D8] bg-[#FAFAFB]',
                  )}
                >
                  {busy === 'file' ? <Spin size="small" /> : <FileUp size={20} strokeWidth={1.75} className="text-muted" />}
                  <span className="text-[13px] font-medium text-ink-2">{busy === 'file' ? 'Uploading…' : 'Choose files, or drop them here'}</span>
                  <span className="tnum text-[11.5px] text-muted">
                    {request.files.length} of {MAX_FILES} files
                  </span>
                </button>
              )}
              {isFlow && busy === 'file' && (
                <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
                  <Spin size="small" /> Uploading…
                </div>
              )}

              <input
                ref={addInput}
                type="file"
                multiple
                hidden
                accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                aria-label="Add files"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []).slice(0, MAX_FILES - request.files.length);
                  e.target.value = '';
                  if (chosen.length > 0) void upload(chosen);
                }}
              />
              <input
                ref={replaceInput}
                type="file"
                hidden
                accept={isFlow ? '.pdf' : ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                aria-label="Replacement file"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  e.target.value = '';
                  if (chosen && replaceTarget.current) void upload([chosen], replaceTarget.current);
                }}
              />
            </div>
          </section>

          {/* 3. The requester's own signature: normal documents only, and only if they want to sign */}
          {!isFlow && (
            <section className="panel px-5 py-5 sm:px-6" aria-label="Your signature">
              <SectionHeading
                number={3}
                title="Your signature and the seal"
                hint="Both optional. Your signature and the date go on when you send it; the company seal goes on when the last step approves."
              />
              <div className="mt-4 sm:pl-9">
                {pdfFiles.length === 0 ? (
                  <p className="text-[12.5px] text-muted">Add a PDF file above first: a signature can only be placed on a PDF.</p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', mySignatures > 0 ? 'bg-ok-soft text-[#15803D]' : 'bg-[#F4F4F5] text-muted')}>
                        <Signature size={17} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink">{mySignatures > 0 ? 'You will sign this document' : 'Not signed by you'}</p>
                        <p className="tnum text-[12px] text-muted">
                          {mySignatures > 0
                            ? `${mySignatures} ${mySignatures === 1 ? 'place' : 'places'}${myDates > 0 ? `, with the date in ${myDates === 1 ? '1 place' : `${myDates} places`}` : ''}`
                            : 'The approvers still sign as usual.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {myBlocks.length > 0 && (
                        <Popconfirm title="Take your signature off this document?" okText="Take it off" cancelText="Keep it" onConfirm={() => void saveMyPlaces([])}>
                          <button type="button" disabled={working} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-50">
                            Remove
                          </button>
                        </Popconfirm>
                      )}
                      <button type="button" disabled={working} onClick={() => setPlacingMine(true)} className={outlineButton}>
                        <Signature size={14} />
                        {myBlocks.length > 0 ? 'Change places' : 'Place my signature'}
                      </button>
                    </div>
                  </div>
                )}
                {pdfFiles.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', sealBlocks.length > 0 ? 'bg-ok-soft text-[#15803D]' : 'bg-[#F4F4F5] text-muted')}>
                        <Stamp size={17} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink">{sealBlocks.length > 0 ? 'Company seal' : 'No company seal'}</p>
                        <p className="tnum text-[12px] text-muted">
                          {sealBlocks.length > 0
                            ? `${sealBlocks.length} ${sealBlocks.length === 1 ? 'place' : 'places'}, stamped when the last step approves`
                            : 'Optional. Stamped by itself when the last step approves.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {sealBlocks.length > 0 && (
                        <Popconfirm title="Take the seal off this document?" okText="Take it off" cancelText="Keep it" onConfirm={() => void saveSealPlaces([])}>
                          <button type="button" disabled={working} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-50">
                            Remove
                          </button>
                        </Popconfirm>
                      )}
                      <button type="button" disabled={working} onClick={() => setPlacingSeal(true)} className={outlineButton}>
                        <Stamp size={14} />
                        {sealBlocks.length > 0 ? 'Change places' : 'Place the seal'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Who approves */}
          <section className="panel px-5 py-5 sm:px-6" aria-label="Who approves">
            <SectionHeading
              number={isFlow ? 3 : 4}
              title="Who approves"
              hint={
                isFlow
                  ? `Set by the document template: it runs ${request.approval_template_code}.`
                  : 'Use a ready-made approval template, or set the steps yourself. Steps are decided in order.'
              }
            />
            <div className="mt-4 sm:pl-9">
              {!isFlow && (
                <div className="mb-4">
                  <label htmlFor="editor-approval-template" className="block text-[13px] font-medium text-ink-2">
                    Approval template <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <Select
                    id="editor-approval-template"
                    value={request.approval_template_id ?? undefined}
                    onChange={(value) => void changeApprovalTemplate(value)}
                    allowClear
                    disabled={working}
                    loading={optionsLoading || busy === 'route'}
                    placeholder="None: I will set the steps myself"
                    options={[
                      ...approvalTemplates.map((t) => ({ value: t.template_id, label: `${t.code} · ${t.name}` })),
                      // The one in use, if it has since been made inactive
                      ...(request.approval_template_id !== null && !approvalTemplates.some((t) => t.template_id === request.approval_template_id)
                        ? [{ value: request.approval_template_id, label: `${request.approval_template_code} · ${request.approval_template_name}` }]
                        : []),
                    ]}
                    className="mt-1.5 w-full sm:max-w-md"
                  />
                </div>
              )}

              {usesTemplate ? (
                <ol className="flex flex-col gap-3" aria-label="Approval steps">
                  {request.steps.map((step, i) => {
                    const draft = steps[i];
                    const open = step.approver_type === 'REQUESTER_SELECT';
                    return (
                      <li key={step.step_no} className="rounded-xl border border-line bg-surface p-3.5">
                        <div className="flex items-start gap-3">
                          <span className="tnum mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[11px] font-semibold text-ink-2">
                            {step.step_no}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="text-[13.5px] font-semibold text-ink">{step.step_name}</span>
                              {(open || step.approvers.length > 1) && (
                                <span className="rounded bg-[#F4F4F5] px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] text-ink-2 uppercase">
                                  {step.approval_rule === 'ALL' ? 'All must approve' : 'Any one approves'}
                                </span>
                              )}
                              {step.due_days > 0 && <span className="tnum text-[12px] text-muted">{describeLimit(step.due_days)}</span>}
                            </p>
                            {open && draft ? (
                              <div className="mt-2">
                                <p className="mb-1.5 text-[12px] text-muted">You choose who does this step.</p>
                                <ApproverSelect
                                  value={draft.approverIds}
                                  onChange={(ids) => patchStep(draft.key, { approverIds: ids })}
                                  users={users}
                                  loading={optionsLoading}
                                  known={knownPeople}
                                  taken={takenElsewhere(draft.key)}
                                  ariaLabel={`Approvers of step ${step.step_no}`}
                                  status={checked && draft.approverIds.length === 0 ? 'error' : undefined}
                                />
                              </div>
                            ) : (
                              <p className="mt-1 text-[12.5px] text-ink-2">
                                {step.approvers.map((a) => a.name).join(step.approval_rule === 'ALL' ? ' and ' : ' or ') || '—'}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <>
                  <ol className="flex flex-col gap-3" aria-label="Approval steps">
                    {steps.map((draft, i) => (
                      <li key={draft.key} className="rounded-xl border border-line bg-surface p-3.5">
                        <div className="flex items-start gap-3">
                          <span className="tnum mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F4F4F5] text-[11px] font-semibold text-ink-2">
                            {i + 1}
                          </span>
                          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[200px_1fr]">
                            <Select
                              value={draft.stepTypeId ?? undefined}
                              onChange={(value) => patchStep(draft.key, { stepTypeId: value })}
                              loading={optionsLoading}
                              placeholder="What is done?"
                              aria-label={`Step ${i + 1} type`}
                              status={(checked || problems.length > 0) && draft.stepTypeId === null ? 'error' : undefined}
                              options={stepTypes.map((t) => ({ value: t.step_type_id, label: t.name_en }))}
                            />
                            <ApproverSelect
                              value={draft.approverIds}
                              onChange={(ids) => patchStep(draft.key, { approverIds: ids })}
                              users={users}
                              loading={optionsLoading}
                              known={knownPeople}
                              taken={takenElsewhere(draft.key)}
                              ariaLabel={`Approvers of step ${i + 1}`}
                              status={checked && draft.approverIds.length === 0 ? 'error' : undefined}
                            />
                            {draft.approverIds.length > 1 && (
                              <div className="sm:col-start-2">
                                <Segmented
                                  size="small"
                                  value={draft.rule}
                                  onChange={(value) => patchStep(draft.key, { rule: value as ApprovalRule })}
                                  options={RULES}
                                  aria-label={`Step ${i + 1} rule`}
                                />
                              </div>
                            )}
                            <label className="flex items-center gap-2 text-[12px] text-muted sm:col-span-2">
                              Time to decide
                              <InputNumber
                                size="small"
                                value={draft.dueDays > 0 ? draft.dueDays : null}
                                onChange={(value) => patchStep(draft.key, { dueDays: value ?? 0 })}
                                min={1}
                                max={365}
                                precision={0}
                                placeholder="No limit"
                                suffix="days"
                                aria-label={`Step ${i + 1} days to decide`}
                                className="w-32!"
                              />
                            </label>
                          </div>
                          <Tooltip title="Remove this step">
                            <button
                              type="button"
                              onClick={() => setSteps((list) => list.filter((s) => s.key !== draft.key))}
                              aria-label={`Remove step ${i + 1}`}
                              className="mt-0.5 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
                            >
                              <Trash2 size={15} />
                            </button>
                          </Tooltip>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {steps.length === 0 && (
                    <p className={cn('rounded-xl border border-dashed px-4 py-5 text-center text-[12.5px]', checked ? 'border-danger-ring bg-danger-soft/40 text-danger-strong' : 'border-[#D4D4D8] bg-[#FAFAFB] text-muted')}>
                      No steps yet. Add the first one below.
                    </p>
                  )}
                  {steps.length < MAX_STEPS && (
                    <button
                      type="button"
                      onClick={() => {
                        setSteps((list) => [...list, { key: nextStepKey++, stepTypeId: null, rule: 'ANY_ONE', approverIds: [], dueDays: 0 }]);
                        setProblems([]);
                      }}
                      className={cn(outlineButton, 'mt-3')}
                    >
                      <Plus size={14} strokeWidth={2.2} />
                      Add step
                    </button>
                  )}
                </>
              )}

              {isFlow && (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
                  <Workflow size={13} className="text-faint" />
                  Each approver’s signature is placed on the document automatically when they approve.
                </p>
              )}
            </div>
          </section>

          {/* Only some documents: the supplier it also goes to, and what they fill in */}
          <section className="panel px-5 py-5 sm:px-6" aria-label="Supplier">
            <SectionHeading
              number={isFlow ? 4 : 5}
              title="Supplier"
              hint="Optional. Only for a document a supplier has to fill in and sign; leave it empty otherwise."
            />
            <div className="mt-4 sm:pl-9">
              <SupplierSection request={request} pdfFiles={pdfFiles} disabled={working} onChanged={setRequest} />
            </div>
          </section>

          {problems.length > 0 && (
            <Alert
              type="error"
              showIcon
              title={problems.length === 1 ? problems[0] : 'A few things to fix first'}
              description={
                problems.length > 1 ? (
                  <ul className="list-disc pl-4">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <Popconfirm
              title={request.round === 0 ? 'Delete this draft?' : 'Cancel this request?'}
              description={request.round === 0 ? 'Its files are removed with it.' : 'It will be closed and cannot be sent again.'}
              okText={request.round === 0 ? 'Delete draft' : 'Cancel request'}
              cancelText="Keep it"
              okButtonProps={{ danger: true }}
              onConfirm={() => void discard()}
            >
              <button
                type="button"
                disabled={working}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong disabled:opacity-50"
              >
                <Trash2 size={14} />
                {request.round === 0 ? 'Delete draft' : 'Cancel request'}
              </button>
            </Popconfirm>
            <div className="flex items-center gap-2">
              <button type="button" disabled={working} onClick={() => void run('save')} className={outlineButton}>
                {busy === 'save' ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                disabled={working || request.viewer.needs_signature}
                onClick={() => void run('send')}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-50"
              >
                <Send size={14} />
                {busy === 'send' ? 'Sending…' : returned ? 'Send again' : 'Send for approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SignBlockEditor
        open={placingMine}
        files={pdfFiles.map((f) => ({ key: fileKey(f.file_id), name: f.original_name, source: { url: documentRequestFileUrl(request.request_id, f.file_id, true, true) } }))}
        signers={[{ kind: 'ISSUER', stepNo: 0, label: 'Your signature', detail: myName, imageUrl: mySignatureUrl }]}
        blocks={myBlocks.map((b) => ({
          key: `saved-${b.sign_block_id}`,
          fileKey: fileKey(b.file_id),
          signerKind: 'ISSUER',
          stepNo: 0,
          content: b.content ?? 'SIGNATURE',
          pageNo: b.page_no,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        }))}
        text={MY_SIGNATURE_TEXT}
        onClose={() => setPlacingMine(false)}
        onSave={(blocks) => void saveMyPlaces(blocks)}
      />

      <SignBlockEditor
        open={placingSeal}
        files={pdfFiles.map((f) => ({ key: fileKey(f.file_id), name: f.original_name, source: { url: documentRequestFileUrl(request.request_id, f.file_id, true, true) } }))}
        signers={[{ kind: 'SEAL', stepNo: 0, label: 'Company seal', detail: 'Stamped when the last step approves', seal: true, imageUrl: sealUrl }]}
        blocks={sealBlocks.map((b) => ({
          key: `saved-${b.sign_block_id}`,
          fileKey: fileKey(b.file_id),
          signerKind: 'SEAL',
          stepNo: 0,
          content: 'SEAL',
          pageNo: b.page_no,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        }))}
        text={SEAL_TEXT}
        onClose={() => setPlacingSeal(false)}
        onSave={(blocks) => void saveSealPlaces(blocks)}
      />

      <RequestPreviewModal request={previewing !== null ? request : null} fileId={previewing ?? undefined} onClose={() => setPreviewing(null)} />
      <RequestPreviewModal
        request={sentBackShown ? request : null}
        round={request.rounds.find((r) => r.round === request.round)}
        onClose={() => setSentBackShown(false)}
      />
    </div>
  );
}
