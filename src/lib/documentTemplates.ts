import { api } from './api';
import type {
  Department,
  DocumentCategory,
  DocumentTemplate,
  DocumentTemplateFile,
  DocumentTemplateInput,
  DocumentTemplateRevision,
  SignBlockInput,
} from '../types/documentTemplate';

const BASE = '/api/document-template';
const CATEGORIES = '/api/document-category';

/** Limits enforced by the backend; mirrored here so the form can say so before uploading. */
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

// ---------- templates ----------

export async function listDocumentTemplates(): Promise<DocumentTemplate[]> {
  const res = await api<{ data: DocumentTemplate[] }>(`${BASE}/get-all`);
  return res.data;
}

export async function getDocumentTemplate(id: number): Promise<DocumentTemplate> {
  const res = await api<{ data: DocumentTemplate }>(`${BASE}/get/${id}`);
  return res.data;
}

export async function createDocumentTemplate(input: DocumentTemplateInput): Promise<DocumentTemplate> {
  const res = await api<{ data: DocumentTemplate }>(`${BASE}/create`, { method: 'POST', body: JSON.stringify(input) });
  return res.data;
}

export async function updateDocumentTemplate(id: number, input: DocumentTemplateInput): Promise<DocumentTemplate> {
  const res = await api<{ data: DocumentTemplate }>(`${BASE}/update/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.data;
}

export async function deleteDocumentTemplate(id: number): Promise<void> {
  await api(`${BASE}/delete/${id}`, { method: 'DELETE' });
}

// ---------- revisions ----------

/** What can be said about a revision when starting or editing it. */
export interface RevisionDetails {
  change_summary: string;
  /** "2026-10-15", or "" for none */
  effective_date: string;
}

/** Every revision of a document, newest first, with its files. */
export async function listDocumentTemplateRevisions(templateId: number): Promise<DocumentTemplateRevision[]> {
  const res = await api<{ data: DocumentTemplateRevision[] }>(`${BASE}/${templateId}/revisions`);
  return res.data;
}

/**
 * Starts the next revision as a draft. It begins with copies of the current revision's files;
 * each copy's `source_file_id` says which file it came from.
 */
export async function startDocumentTemplateRevision(templateId: number, details: RevisionDetails): Promise<DocumentTemplateRevision> {
  const res = await api<{ data: DocumentTemplateRevision }>(`${BASE}/${templateId}/revisions`, {
    method: 'POST',
    body: JSON.stringify(details),
  });
  return res.data;
}

export async function updateDocumentTemplateRevision(
  templateId: number,
  revisionId: number,
  details: RevisionDetails,
): Promise<DocumentTemplateRevision> {
  const res = await api<{ data: DocumentTemplateRevision }>(`${BASE}/${templateId}/revisions/${revisionId}`, {
    method: 'PUT',
    body: JSON.stringify(details),
  });
  return res.data;
}

/** Makes a draft the revision in force and returns the document as it then stands. */
export async function publishDocumentTemplateRevision(templateId: number, revisionId: number): Promise<DocumentTemplate> {
  const res = await api<{ data: DocumentTemplate }>(`${BASE}/${templateId}/revisions/${revisionId}/publish`, { method: 'POST' });
  return res.data;
}

/** Throws away a draft revision (never the first one). The revision in force is unaffected. */
export async function discardDocumentTemplateRevision(templateId: number, revisionId: number): Promise<void> {
  await api(`${BASE}/${templateId}/revisions/${revisionId}`, { method: 'DELETE' });
}

// ---------- signature layout (of the draft revision of a FLOW document) ----------

/** Replaces the whole signature layout of the draft revision. */
export async function saveDocumentTemplateSignBlocks(templateId: number, blocks: SignBlockInput[]): Promise<DocumentTemplateRevision> {
  const res = await api<{ data: DocumentTemplateRevision }>(`${BASE}/${templateId}/sign-blocks`, {
    method: 'PUT',
    body: JSON.stringify({ blocks }),
  });
  return res.data;
}

// ---------- files (of the draft revision) ----------

export async function uploadDocumentTemplateFile(templateId: number, file: File, label: string): Promise<DocumentTemplateFile> {
  const body = new FormData();
  body.append('file', file);
  body.append('label', label);
  const res = await api<{ data: DocumentTemplateFile }>(`${BASE}/${templateId}/files`, { method: 'POST', body });
  return res.data;
}

export async function renameDocumentTemplateFile(templateId: number, fileId: number, label: string): Promise<DocumentTemplateFile> {
  const res = await api<{ data: DocumentTemplateFile }>(`${BASE}/${templateId}/files/${fileId}`, {
    method: 'PUT',
    body: JSON.stringify({ label }),
  });
  return res.data;
}

/** Hides the file from the template. It is kept on the server so it can be restored. */
export async function removeDocumentTemplateFile(templateId: number, fileId: number): Promise<void> {
  await api(`${BASE}/${templateId}/files/${fileId}`, { method: 'DELETE' });
}

/** Link that downloads a file (or opens it in the browser with `inline`). Needs the session cookie. */
export function documentTemplateFileUrl(templateId: number, fileId: number, inline = false): string {
  return `${BASE}/${templateId}/files/${fileId}/download${inline ? '?inline=1' : ''}`;
}

// ---------- categories ----------

export async function listDocumentCategories(activeOnly = false): Promise<DocumentCategory[]> {
  const res = await api<{ data: DocumentCategory[] }>(`${CATEGORIES}/get-all${activeOnly ? '?active=1' : ''}`);
  return res.data;
}

/** Adds a category. The backend generates its code from the English name and puts it last in the list. */
export async function createDocumentCategory(input: { name_en: string; name_th: string }): Promise<DocumentCategory> {
  const res = await api<{ data: DocumentCategory }>(`${CATEGORIES}/create`, { method: 'POST', body: JSON.stringify(input) });
  return res.data;
}

export async function updateDocumentCategory(
  id: number,
  input: { code: string; name_en: string; name_th: string; is_active: boolean },
): Promise<DocumentCategory> {
  const res = await api<{ data: DocumentCategory }>(`${CATEGORIES}/update/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.data;
}

export async function deleteDocumentCategory(id: number): Promise<void> {
  await api(`${CATEGORIES}/delete/${id}`, { method: 'DELETE' });
}

// ---------- departments ----------

/** The units a document can be filed under, in the order they should be offered. */
export async function listDepartments(): Promise<Department[]> {
  const res = await api<{ data: Department[] }>(`${BASE}/departments?active=1`);
  return res.data;
}

// ---------- display helpers ----------

/** 2 -> "Rev.02" */
export function revisionLabel(revisionNo: number): string {
  return `Rev.${String(revisionNo).padStart(2, '0')}`;
}

/** 1536 -> "1.5 KB", 5242880 -> "5 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "Report.PDF" -> "pdf" */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}
