import type { ApprovalRule, ApproverType } from './approval';
import type { BlockContent, SignerKind, TemplateType } from './documentTemplate';

/** Where a request's files come from: uploaded by the requester, or taken from a document template. */
export type RequestSource = 'UPLOAD' | 'TEMPLATE';

/** Where a request is in its life. */
export type RequestStatus = 'DRAFT' | 'IN_PROGRESS' | 'WITH_SUPPLIER' | 'APPROVED' | 'RETURNED' | 'CANCELLED';

export type RequestStepStatus = 'WAITING' | 'ACTIVE' | 'APPROVED' | 'REJECTED';
export type RequestDecision = 'PENDING' | 'APPROVED' | 'REJECTED';
/** RECALL: the requester took the request back to change it while it was waiting for approval. */
export type RequestAction =
  | 'SUBMIT'
  | 'RESUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'RECALL'
  // The supplier filled the document in and signed it / sent it back with a reason
  | 'SUPPLIER_SUBMIT'
  | 'SUPPLIER_RETURN';

/** BEFORE: the supplier answers first, then the approval steps run. AFTER: the other way round. */
export type SupplierTiming = 'BEFORE' | 'AFTER';

/** The supplier a request also goes to, and where their part stands in the current round. */
export interface RequestSupplier {
  supplier_id: number;
  code: string;
  name: string;
  timing: SupplierTiming;
  /** '' until it reaches them; then waiting for their answer, answered, or sent back by them */
  state: '' | 'WAITING' | 'DONE' | 'RETURNED';
  sent_at: string | null;
  done_at: string | null;
  /** Who answered at the supplier */
  signer_email: string;
  signer_name: string;
  /** Why they sent it back */
  comment: string;
}

/** One place the supplier fills, as sent when the requester lays them out. */
export interface SupplierBlockInput {
  file_id: number;
  content: BlockContent | 'FIELD';
  /** FIELD only */
  label?: string;
  field_type?: 'TEXT' | 'DATE';
  field_required?: boolean;
  page_no: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentRequestFile {
  file_id: number;
  /** The template file this one stands for; null for a file the requester added */
  template_file_id: number | null;
  label: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
  /** A copy with the signatures collected so far exists; downloads serve it unless the original is asked for */
  signed: boolean;
  signed_at: string | null;
}

/** One person who can decide a step, and what they decided in the current round. */
export interface RequestApprover {
  user_id: number;
  employee_code: string;
  name: string;
  position: string;
  department_code: string;
  decision: RequestDecision;
  decided_at: string | null;
  comment: string;
  signature_id: number | null;
}

export interface DocumentRequestStep {
  step_no: number;
  step_type_id: number | null;
  step_type_code: string;
  step_name: string;
  /** USER: approvers fixed by the approval template. REQUESTER_SELECT: chosen by the requester. */
  approver_type: ApproverType;
  approval_rule: ApprovalRule;
  status: RequestStepStatus;
  completed_at: string | null;
  /** Days the approvers have to decide once the request reaches the step; 0 for no limit */
  due_days: number;
  /** When the request reached the step in this round, and when its time runs out (null without a limit) */
  activated_at: string | null;
  due_at: string | null;
  /** Waiting for a decision past its time */
  overdue: boolean;
  approvers: RequestApprover[];
}

export interface RequestSignBlock {
  sign_block_id: number;
  file_id: number;
  /**
   * STEP and ISSUER come from a flow template; APPROVER is a place an approver chose while approving
   * a normal document; SUPPLIER is something the supplier fills.
   */
  signer_kind: SignerKind | 'APPROVER' | 'SUPPLIER';
  step_no: number;
  /** For APPROVER: the employee code of who placed it */
  signer_code: string;
  label: string;
  /** FIELD (SUPPLIER only): something typed; `label` is then the question. SEAL: the company seal. */
  content: BlockContent | 'FIELD' | 'SEAL';
  field_type?: '' | 'TEXT' | 'DATE';
  field_required?: boolean;
  /** The supplier's latest answer (a date as YYYY-MM-DD) */
  field_value?: string;
  page_no: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One line of a request's history. */
export interface RequestHistoryEntry {
  /** Which sending this belongs to: 1 the first time, 2 after the first return, ... */
  round: number;
  /** 0 for something the requester did */
  step_no: number;
  action: RequestAction;
  actor_code: string;
  actor_name: string;
  comment: string;
  signature_id: number | null;
  created_at: string;
}

/** One file as it was in one round. */
export interface RequestRoundFile {
  round_file_id: number;
  /** The request file this is a record of, which may have been replaced since */
  file_id: number;
  label: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  /** A copy with the signatures that round collected exists */
  signed: boolean;
  signed_at: string | null;
}

/**
 * One sending of the request with the files it had then. A round that was sent back keeps its
 * files, and the signatures it had collected, even after the requester replaces them.
 */
export interface RequestRound {
  round: number;
  sent_at: string;
  files: RequestRoundFile[];
}

/** What the signed-in person can do with the request right now. */
export interface RequestViewer {
  is_requester: boolean;
  /** The requester may change the request and send it (draft or returned) */
  can_edit: boolean;
  /** It is the viewer's turn to approve or reject */
  can_decide: boolean;
  has_signature: boolean;
  /** The viewer's next action (approve, or send) is blocked until they set a signature */
  needs_signature: boolean;
}

/** A document sent, or about to be sent, for approval. */
export interface DocumentRequest {
  request_id: number;
  request_no: string;
  title: string;
  description: string;
  source: RequestSource;
  doc_type: TemplateType;

  document_template_id: number | null;
  template_revision_id: number | null;
  doc_code: string;
  doc_name: string;
  revision_no: number;
  /**
   * The revision of the document template now in force (0 when not made from a template, and in
   * lists). Above `revision_no` means the form has changed since the request was made.
   */
  template_latest_revision_no: number;
  approval_template_id: number | null;
  approval_template_code: string;
  approval_template_name: string;

  status: RequestStatus;
  /** How many times it has been sent; 0 while still a first draft */
  round: number;
  current_step_no: number;
  /** While returned: the step whose approver sent it back, or 0 when the requester took it back themselves */
  returned_step_no: number;
  step_count: number;
  current_step_name: string;

  requester_user_id: number;
  requester_code: string;
  requester_name: string;
  requester_department_code: string;
  issuer_signature_id: number | null;
  /** The last day the document is valid, as YYYY-MM-DD; null when it does not expire */
  valid_until: string | null;
  /** The moment `valid_until` ends, once the request is approved; null until then */
  expires_at: string | null;
  expired: boolean;
  /** Null for most requests, which stay inside the plant */
  supplier: RequestSupplier | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;

  file_count: number;
  files: DocumentRequestFile[];
  steps: DocumentRequestStep[];
  sign_blocks: RequestSignBlock[];
  /** Oldest first */
  history: RequestHistoryEntry[];
  /** The files of every round the request was sent, oldest first; empty for a draft never sent */
  rounds: RequestRound[];
  viewer: RequestViewer;
}

/** Where an approver puts their signature on a normal document. Fractions of the page, from its top-left corner. */
export interface SignaturePlacement {
  file_id: number;
  /** The signature itself, or the date of the approval */
  content: BlockContent;
  page_no: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One step when saving who approves. Steps are numbered by position. */
export interface RequestRouteStepInput {
  /** Only for a route the requester defines (no approval template) */
  step_type_id?: number | null;
  approval_rule?: ApprovalRule;
  approver_user_ids: number[];
  /** Days to decide, for a route the requester defines; 0 for no limit */
  due_days?: number;
}
