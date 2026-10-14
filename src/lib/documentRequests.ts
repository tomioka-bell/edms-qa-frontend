import { api, apiBlob } from './api';
import type {
  DocumentRequest,
  DocumentRequestFile,
  RequestRouteStepInput,
  RequestStatus,
  SignaturePlacement,
  SupplierBlockInput,
  SupplierTiming,
} from '../types/documentRequest';

const BASE = '/api/document-request';

/** What each status is called on screen. */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In approval',
  WITH_SUPPLIER: 'With supplier',
  APPROVED: 'Approved',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

// An older backend leaves out what was added later; every screen can then count on these being there
const withRounds = (request: DocumentRequest): DocumentRequest => ({
  ...request,
  rounds: request.rounds ?? [],
  template_latest_revision_no: request.template_latest_revision_no ?? 0,
  supplier: request.supplier ?? null,
  valid_until: request.valid_until ?? null,
  expires_at: request.expires_at ?? null,
  expired: request.expired ?? false,
  steps: request.steps.map((step) => ({
    ...step,
    due_days: step.due_days ?? 0,
    activated_at: step.activated_at ?? null,
    due_at: step.due_at ?? null,
    overdue: step.overdue ?? false,
  })),
});

/** mine: requests I made. inbox: waiting for my decision. all: everything I may see. */
export type RequestScope = 'mine' | 'inbox' | 'all';

export async function listDocumentRequests(scope: RequestScope): Promise<DocumentRequest[]> {
  const res = await api<{ data: DocumentRequest[] }>(`${BASE}/get-all?scope=${scope}`);
  return res.data.map(withRounds);
}

export async function getDocumentRequest(id: number): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/get/${id}`);
  return withRounds(res.data);
}

/** Starts a draft from files the requester will upload. Always a normal document. */
export async function createUploadRequest(title: string, description: string): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/create`, {
    method: 'POST',
    body: JSON.stringify({ source: 'UPLOAD', title, description }),
  });
  return withRounds(res.data);
}

/** Starts a draft from a document template, which supplies the files and decides normal or flow. */
export async function createTemplateRequest(documentTemplateId: number, title: string, description: string): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/create`, {
    method: 'POST',
    body: JSON.stringify({ source: 'TEMPLATE', document_template_id: documentTemplateId, title, description }),
  });
  return withRounds(res.data);
}

/**
 * Changes a draft or returned request. `approval_template_id` copies that template's route over
 * the current one; 0 drops the template so the requester defines the steps.
 */
export async function updateDocumentRequest(
  id: number,
  changes: { title?: string; description?: string; approval_template_id?: number; valid_until?: string },
): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/update/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
  return withRounds(res.data);
}

/** Sets who approves: the open steps of the approval template, or a whole route of the requester's own. */
export async function saveDocumentRequestRoute(id: number, steps: RequestRouteStepInput[]): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/route`, { method: 'PUT', body: JSON.stringify({ steps }) });
  return withRounds(res.data);
}

/** Only a draft that was never sent. */
export async function deleteDocumentRequest(id: number): Promise<void> {
  await api(`${BASE}/delete/${id}`, { method: 'DELETE' });
}

/** Adds a file, or with `replaces` puts the upload in the place of that file (keeping its signature blocks). */
export async function uploadDocumentRequestFile(id: number, file: File, replaces?: number): Promise<DocumentRequestFile> {
  const body = new FormData();
  body.append('file', file);
  if (replaces) body.append('replaces', String(replaces));
  const res = await api<{ data: DocumentRequestFile }>(`${BASE}/${id}/files`, { method: 'POST', body });
  return res.data;
}

export async function removeDocumentRequestFile(id: number, fileId: number): Promise<void> {
  await api(`${BASE}/${id}/files/${fileId}`, { method: 'DELETE' });
}

/**
 * Link that downloads a file (or opens it in the browser with `inline`). Needs the session cookie.
 * Once someone has signed, this is the copy with the signatures on it; `original` asks for the file as it was sent.
 */
export function documentRequestFileUrl(id: number, fileId: number, inline = false, original = false): string {
  const query = [inline ? 'inline=1' : '', original ? 'original=1' : ''].filter(Boolean).join('&');
  return `${BASE}/${id}/files/${fileId}/download${query ? `?${query}` : ''}`;
}

/** Link to a file as it was in one round (see RequestRound), with that round's signatures unless `original`. */
export function documentRequestRoundFileUrl(id: number, roundFileId: number, inline = false, original = false): string {
  const query = [inline ? 'inline=1' : '', original ? 'original=1' : ''].filter(Boolean).join('&');
  return `${BASE}/${id}/rounds/files/${roundFileId}/download${query ? `?${query}` : ''}`;
}

/** Sends a draft for approval, or sends a returned request again. */
export async function submitDocumentRequest(id: number): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/submit`, { method: 'POST' });
  return withRounds(res.data);
}

export async function cancelDocumentRequest(id: number, comment = ''): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/cancel`, { method: 'POST', body: JSON.stringify({ comment }) });
  return withRounds(res.data);
}

/**
 * Approves the step the caller is an approver of. Needs a signature on file. For a normal document
 * with PDF files, `placements` says where that signature goes; a flow document already knows.
 */
export async function approveDocumentRequest(id: number, comment = '', placements: SignaturePlacement[] = []): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment, sign_blocks: placements }),
  });
  return withRounds(res.data);
}

/** Sends the request back to the requester at once. The reason is required. */
export async function rejectDocumentRequest(id: number, comment: string): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) });
  return withRounds(res.data);
}

/**
 * One PDF of the request as it would look if the caller approved now: the signatures already
 * collected plus their own, in the place it would go. Nothing is saved.
 */
export function previewApprovedFile(id: number, fileId: number, placements: SignaturePlacement[] = []): Promise<Blob> {
  return apiBlob(`${BASE}/${id}/files/${fileId}/approval-preview`, { method: 'POST', body: JSON.stringify({ sign_blocks: placements }) });
}

/**
 * The requester takes a request that is waiting for approval back, to change it. It then stands as
 * a returned request does, and is sent again as a new round.
 */
export async function recallDocumentRequest(id: number, comment = ''): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/recall`, { method: 'POST', body: JSON.stringify({ comment }) });
  return withRounds(res.data);
}

/**
 * Moves a draft or returned request onto the revision of its document template now in force: that
 * revision's files, signature places and (for a flow document) approval route.
 */
export async function moveToLatestRevision(id: number): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/use-latest-revision`, { method: 'POST' });
  return withRounds(res.data);
}

/**
 * Sets where the requester's own signature (and its date) go on a normal document they are
 * preparing. Optional: an empty list takes the places away. Sending the request then signs it there.
 */
/** Saves where the company seal goes on a normal document; an empty list takes it off. It is stamped when the last step passes. */
export async function saveSealBlocks(id: number, placements: SignaturePlacement[]): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/seal-blocks`, { method: 'PUT', body: JSON.stringify({ sign_blocks: placements }) });
  return withRounds(res.data);
}

export async function saveIssuerSignBlocks(id: number, placements: SignaturePlacement[]): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/issuer-blocks`, { method: 'PUT', body: JSON.stringify({ sign_blocks: placements }) });
  return withRounds(res.data);
}

/**
 * Says which supplier the request also goes to, and whether before or after the approval steps.
 * A null supplier takes it off again, along with the places that were set for it.
 */
export async function setRequestSupplier(id: number, supplierId: number | null, timing: SupplierTiming = 'AFTER'): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/supplier`, {
    method: 'PUT',
    body: JSON.stringify({ supplier_id: supplierId ?? 0, timing }),
  });
  return withRounds(res.data);
}

/** Saves what the supplier fills on the files: the complete set; an empty list takes the places away. */
export async function saveSupplierBlocks(id: number, blocks: SupplierBlockInput[]): Promise<DocumentRequest> {
  const res = await api<{ data: DocumentRequest }>(`${BASE}/${id}/supplier-blocks`, { method: 'PUT', body: JSON.stringify({ blocks }) });
  return withRounds(res.data);
}

/** True when it is the supplier who sent the request back (not an approver, and not the requester taking it back). */
export const sentBackBySupplier = (request: Pick<DocumentRequest, 'status' | 'supplier'>) =>
  request.status === 'RETURNED' && request.supplier?.state === 'RETURNED';

/** True when the requester took the request back themselves: nobody sent it back, so there is no reason to show. */
export const takenBackByRequester = (request: Pick<DocumentRequest, 'status' | 'supplier' | 'returned_step_no'>) =>
  request.status === 'RETURNED' && request.returned_step_no === 0 && !sentBackBySupplier(request);
