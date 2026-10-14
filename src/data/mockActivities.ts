import type { ActivityItem, ApprovalQueueItem, NotificationItem } from '../types/document';

export const mockActivities: ActivityItem[] = [
  {
    id: 'a-1',
    kind: 'submitted',
    docCode: 'QMS-WI-018',
    message: 'Revision 08 submitted for approval',
    actor: 'N. Somchai',
    timestamp: '2026-09-22T08:42:00',
  },
  {
    id: 'a-2',
    kind: 'published',
    docCode: 'QMS-P-001',
    message: 'was published as Revision 12',
    actor: 'S. Tanaka',
    timestamp: '2026-09-22T07:15:00',
  },
  {
    id: 'a-3',
    kind: 'approved',
    docCode: 'QMS-F-024',
    message: 'approved by P. Kanya',
    actor: 'P. Kanya',
    timestamp: '2026-09-21T16:28:00',
  },
  {
    id: 'a-4',
    kind: 'review-requested',
    docCode: 'QMS-P-031',
    message: 'review requested from QA Manager',
    actor: 'A. Wichai',
    timestamp: '2026-09-21T14:05:00',
  },
  {
    id: 'a-5',
    kind: 'revision-created',
    docCode: 'QMS-P-063',
    message: 'Revision 04 created from Revision 03',
    actor: 'T. Prasert',
    timestamp: '2026-09-21T11:30:00',
  },
  {
    id: 'a-6',
    kind: 'archived',
    docCode: 'QMS-WI-009',
    message: 'was archived and superseded by QMS-WI-062',
    actor: 'Puvadon A.',
    timestamp: '2026-09-20T17:50:00',
  },
  {
    id: 'a-7',
    kind: 'rejected',
    docCode: 'QMS-ST-003',
    message: 'returned to author with review comments',
    actor: 'QA Manager',
    timestamp: '2026-09-20T09:12:00',
  },
];

export const mockApprovalQueue: ApprovalQueueItem[] = [
  {
    id: 'q-1',
    code: 'QMS-P-021',
    name: 'Supplier Quality Management Procedure',
    revision: 4,
    owner: 'QA System',
    dueDate: '2026-09-22',
    dueLabel: 'Due today',
    urgency: 'today',
    stage: 'Approval',
  },
  {
    id: 'q-2',
    code: 'QMS-WI-045',
    name: 'Incoming Inspection Work Instruction',
    revision: 7,
    owner: 'Incoming QA',
    dueDate: '2026-09-24',
    dueLabel: 'Due Sep 24',
    urgency: 'soon',
    stage: 'Approval',
  },
  {
    id: 'q-3',
    code: 'QMS-F-102',
    name: 'Process Audit Checklist',
    revision: 3,
    owner: 'QA Audit',
    dueDate: '2026-09-26',
    dueLabel: 'Due Sep 26',
    urgency: 'normal',
    stage: 'Review',
  },
  {
    id: 'q-4',
    code: 'QMS-P-063',
    name: 'Change Management Procedure',
    revision: 4,
    owner: 'T. Prasert',
    dueDate: '2026-09-19',
    dueLabel: 'Overdue by 3 days',
    urgency: 'overdue',
    stage: 'Review',
  },
  {
    id: 'q-5',
    code: 'QMS-WI-018',
    name: 'Final Inspection Standard',
    revision: 8,
    owner: 'N. Somchai',
    dueDate: '2026-09-29',
    dueLabel: 'Due Sep 29',
    urgency: 'normal',
    stage: 'Review',
  },
];

export const mockNotifications: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'QMS-P-021 awaits your approval',
    detail: 'Supplier Quality Management Procedure · Rev. 04 · due today',
    timestamp: '2026-09-22T08:05:00',
    unread: true,
    tone: 'action',
  },
  {
    id: 'n-2',
    title: '3 documents expire within 30 days',
    detail: 'QMS-SP-014, QMS-ST-003, QMS-WI-031 require review scheduling',
    timestamp: '2026-09-22T07:00:00',
    unread: true,
    tone: 'warning',
  },
  {
    id: 'n-3',
    title: 'QMS-P-063 review is overdue',
    detail: 'Change Management Procedure · 3 days past due date',
    timestamp: '2026-09-21T18:20:00',
    unread: true,
    tone: 'warning',
  },
  {
    id: 'n-4',
    title: 'QMS-P-001 published',
    detail: 'Revision 12 is now the effective controlled copy',
    timestamp: '2026-09-21T09:40:00',
    unread: false,
    tone: 'info',
  },
  {
    id: 'n-5',
    title: 'QMS-F-024 approved',
    detail: 'Approved by P. Kanya on 21 Sep 2026',
    timestamp: '2026-09-20T15:10:00',
    unread: false,
    tone: 'info',
  },
];

/** Master data used to populate selects across the app. */
export const owners = [
  'S. Tanaka',
  'N. Somchai',
  'P. Kanya',
  'A. Wichai',
  'T. Prasert',
  'K. Narong',
  'C. Sompong',
  'W. Siriporn',
  'Puvadon A.',
  'QA System',
  'QA Audit',
  'Incoming QA',
];

export const reviewers = ['QA Manager', 'QA Section Head', 'Engineering Manager', 'Production Manager'];
export const approvers = ['Managing Director', 'Plant Manager', 'QA Director'];

export const currentUser = {
  name: 'Puvadon A.',
  role: 'IT Administrator',
  initials: 'PA',
  firstName: 'Puvadon',
  email: 'puvadon.a@prospira.com',
};
