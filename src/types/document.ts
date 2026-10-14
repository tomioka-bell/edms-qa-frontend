export type DocCategory =
  | 'Procedure'
  | 'Work Instruction'
  | 'Standard'
  | 'Form'
  | 'Manual'
  | 'Specification'
  | 'Record';

export type Department =
  | 'QA'
  | 'Production'
  | 'Engineering'
  | 'Warehouse'
  | 'Purchasing'
  | 'Maintenance';

export type DocStatus =
  | 'Draft'
  | 'Under Review'
  | 'Pending Approval'
  | 'Active'
  | 'Expiring Soon'
  | 'Expired'
  | 'Archived';

export type ReviewCycle = '6 Months' | '1 Year' | '2 Years' | '3 Years';

export type ApprovalState = 'Completed' | 'In Progress' | 'Pending' | 'Rejected';

export interface ApprovalStep {
  role: 'Prepared by' | 'Reviewed by' | 'Approved by';
  name: string;
  position?: string;
  state: ApprovalState;
  /** ISO date — present when the step has been actioned. */
  date?: string;
  note?: string;
}

export interface RevisionEntry {
  revision: number;
  date: string;
  summary: string;
  author?: string;
  reason?: string;
}

export interface DocFile {
  name: string;
  /** Human-readable, e.g. "2.4 MB" */
  size: string;
  uploadedAt: string;
  type: 'pdf' | 'docx' | 'xlsx';
}

export interface QaDocument {
  id: string;
  code: string;
  name: string;
  category: DocCategory;
  department: Department;
  revision: number;
  owner: string;
  ownerRole?: string;
  effectiveDate: string;
  nextReviewDate: string;
  createdDate: string;
  status: DocStatus;
  description: string;
  file: DocFile;
  approvals: ApprovalStep[];
  revisions: RevisionEntry[];
  reviewCycle: ReviewCycle;
}

export type ActivityKind =
  | 'submitted'
  | 'published'
  | 'approved'
  | 'review-requested'
  | 'archived'
  | 'revision-created'
  | 'rejected';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** Rich text is composed in the component from these parts. */
  docCode: string;
  message: string;
  actor: string;
  timestamp: string;
}

export interface ApprovalQueueItem {
  id: string;
  code: string;
  name: string;
  revision: number;
  owner: string;
  dueDate: string;
  /** Pre-computed for display: "Due today", "Due Sep 24" … */
  dueLabel: string;
  urgency: 'overdue' | 'today' | 'soon' | 'normal';
  stage: 'Review' | 'Approval';
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  unread: boolean;
  tone: 'action' | 'info' | 'warning';
}
