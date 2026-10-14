/** A kind of document (procedure, form, ...) from the category master table. */
export interface DocumentCategory {
  category_id: number;
  code: string;
  name_en: string;
  name_th: string;
  sort_order: number;
  is_active: boolean;
}

/** A unit documents are filed under: QA, QC, QA-Incoming, ... (the backend's document department list). */
export interface Department {
  department_id: number;
  /** Short name shown in lists, e.g. "QA-Incoming" */
  code: string;
  /** Full name, e.g. "QA Incoming Inspection" */
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** One file of one revision of a document template. */
export interface DocumentTemplateFile {
  file_id: number;
  /** The file of the previous revision this one was carried over from; null for a newly uploaded file */
  source_file_id: number | null;
  /** What this file is, e.g. "Main form"; may be empty */
  label: string;
  original_name: string;
  /** Lower case, without the dot: "pdf", "docx", ... */
  extension: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  uploaded_by: string;
  uploaded_at: string;
}

/**
 * What kind of document template this is. A FLOW template runs an approval flow by itself: it is
 * tied to an approval template and says where each signer's signature goes on its PDF pages.
 */
export type TemplateType = 'NORMAL' | 'FLOW';

/**
 * Whose signature a block is for: an approval step's approver, the person who issues the document,
 * or the supplier a form is sent to (who can also be given fields to type into).
 */
export type SignerKind = 'STEP' | 'ISSUER' | 'SUPPLIER' | 'SEAL';

/** What a block puts on the page: the signer's signature, or the day they signed (written as 08-Oct-26). */
export type BlockContent = 'SIGNATURE' | 'DATE';

/**
 * One box on a PDF page where a signature is placed. x, y, width and height are fractions of the
 * page (0 to 1), measured from its top-left corner.
 */
export interface SignBlock {
  sign_block_id: number;
  file_id: number;
  signer_kind: SignerKind;
  /** Step of the approval template; 0 for the issuer */
  step_no: number;
  /** For a FIELD: the question the supplier is asked */
  label: string;
  /** FIELD (SUPPLIER only): something the supplier types. SEAL (SEAL only): the company seal. */
  content: BlockContent | 'FIELD' | 'SEAL';
  field_type?: '' | 'TEXT' | 'DATE';
  field_required?: boolean;
  /** 1 is the first page */
  page_no: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A block as sent when saving a layout. */
export type SignBlockInput = Omit<SignBlock, 'sign_block_id' | 'label'> & { label?: string };

/**
 * Where a revision is in its life: being prepared, in force, or an earlier version kept for history.
 * Only a draft's files can be added or removed.
 */
export type RevisionStatus = 'DRAFT' | 'CURRENT' | 'SUPERSEDED';

/** One version of a document: Rev.01, Rev.02, ... with its details and full set of files as of that version. */
export interface DocumentTemplateRevision {
  revision_id: number;
  revision_no: number;
  status: RevisionStatus;
  // The document's details as of this revision
  code: string;
  name: string;
  description: string;
  category_id: number;
  category_code: string;
  category_name: string;
  department_id: number;
  department_code: string;
  department_name: string;
  template_type: TemplateType;
  /** For FLOW: the approval template this revision runs */
  approval_template_id: number | null;
  approval_template_code: string;
  approval_template_name: string;
  /** For FLOW: where the signatures go */
  sign_blocks: SignBlock[];
  /** What changed compared with the previous revision; empty for Rev.01 */
  change_summary: string;
  /** "2026-10-15", or "" when none was given */
  effective_date: string;
  file_count: number;
  files: DocumentTemplateFile[];
  created_by: string;
  created_at: string;
  published_by: string;
  /** "" until published */
  published_at: string;
}

/** A document code with its revisions. `files` are those of the revision in force. */
export interface DocumentTemplate {
  document_template_id: number;
  code: string;
  name: string;
  description: string;
  category_id: number;
  category_code: string;
  category_name_en: string;
  category_name_th: string;
  department_id: number;
  department_code: string;
  department_name: string;
  is_active: boolean;
  // Of the revision in force (or the first draft)
  template_type: TemplateType;
  approval_template_id: number | null;
  approval_template_code: string;
  approval_template_name: string;
  sign_block_count: number;
  /** The revision in force; null while the first revision is still a draft */
  current_revision: DocumentTemplateRevision | null;
  /** A revision being prepared; null when there is none */
  draft_revision: DocumentTemplateRevision | null;
  revision_count: number;
  /** Files of the revision in force, or of the first draft while nothing is published yet */
  file_count: number;
  files: DocumentTemplateFile[];
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

/**
 * Body of a create / update request. An update is written to the document's draft revision; a
 * document whose revision is published needs a new revision started first.
 */
export interface DocumentTemplateInput {
  code: string;
  name: string;
  description: string;
  category_id: number;
  department_id: number;
  template_type: TemplateType;
  /** Required for FLOW; ignored for NORMAL */
  approval_template_id: number | null;
}
