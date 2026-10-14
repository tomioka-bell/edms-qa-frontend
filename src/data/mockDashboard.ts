/**
 * Dashboard figures for the PSTH EDMS overview, mirroring the customer
 * mock-up. The lifecycle stages sum to the document total.
 */

export type LifecycleStage =
  | 'Draft'
  | 'Under Review'
  | 'Pending Approval'
  | 'Released'
  | 'Review Due'
  | 'Expired'
  | 'Obsolete';

/** Status colours, in lifecycle order. Validated as a set; the donut adds
 *  2px gaps and a labelled legend because Released ↔ Review Due is weak for
 *  protan readers. */
export const LIFECYCLE: { stage: LifecycleStage; count: number; color: string }[] = [
  { stage: 'Draft', count: 2, color: '#B9BDC7' },
  { stage: 'Under Review', count: 2, color: '#4169E1' },
  { stage: 'Pending Approval', count: 3, color: '#8B5CF6' },
  { stage: 'Released', count: 25, color: '#4CA56B' },
  { stage: 'Review Due', count: 1, color: '#F0B429' },
  { stage: 'Expired', count: 2, color: '#D93A3A' },
  { stage: 'Obsolete', count: 3, color: '#3B3F4A' },
];

export const TOTAL_DOCUMENTS = LIFECYCLE.reduce((sum, s) => sum + s.count, 0);

export interface Kpi {
  key: 'total' | 'active' | 'pending' | 'compliance';
  label: string;
  value: string;
  sub: string;
  /** Percent change vs last month. */
  delta: number;
  /** Whether an increase is good news for this metric. */
  upIsGood: boolean;
}

export const KPIS: Kpi[] = [
  { key: 'total', label: 'Total Documents', value: String(TOTAL_DOCUMENTS), sub: 'vs. last month', delta: 3.2, upIsGood: true },
  { key: 'active', label: 'Active Documents', value: '26', sub: '25 released · 2 under review', delta: 18, upIsGood: true },
  { key: 'pending', label: 'Pending Approval', value: '5', sub: '5 overdue approvals', delta: -2, upIsGood: false },
  { key: 'compliance', label: 'Compliance', value: '45%', sub: 'valid · reviewed · acknowledged', delta: -2, upIsGood: true },
];

/** Last 12 months, Oct → Sep. Both series are percentages on one axis. */
export const COMPLIANCE_TREND = {
  months: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  series: [
    { key: 'compliance', label: 'Compliance %', color: '#E8703A', values: [62, 64, 60, 57, 58, 55, 53, 50, 48, 47, 46, 45] },
    { key: 'ontime', label: 'On-time review %', color: '#34446E', values: [80, 82, 85, 84, 88, 87, 90, 89, 90, 89, 91, 90] },
  ],
};

export type AlertKind = 'expired' | 'review-due' | 'expiring';

export interface DocAlert {
  id: string;
  code: string;
  title: string;
  kind: AlertKind;
  detail: string;
}

export const DOC_ALERTS: DocAlert[] = [
  { id: 'al-1', code: 'PSD-P-002', title: 'Breakdown Maintenance Procedure', kind: 'expired', detail: 'Expired 01-Sept-2025' },
  { id: 'al-2', code: 'ACC-P-006', title: 'Fixed Asset Management Procedure', kind: 'expired', detail: 'Expired 01-Jul-2025' },
  { id: 'al-3', code: 'ENG-P-003', title: 'Design Change Control Procedure', kind: 'review-due', detail: 'Review due 01-Sept-2026' },
  { id: 'al-4', code: 'PD-REC-020', title: 'Mold Change Record', kind: 'expiring', detail: 'Expires in 2 days' },
];

export const WORKLOAD: { code: string; department: string; count: number }[] = [
  { code: 'PD', department: 'Production', count: 7 },
  { code: 'QA', department: 'Quality Assurance', count: 6 },
  { code: 'IT', department: 'Information Technology', count: 5 },
  { code: 'ENG', department: 'Engineering', count: 4 },
  { code: 'SHE', department: 'Safety, Health & Environment', count: 4 },
  { code: 'PSD', department: 'Maintenance', count: 3 },
  { code: 'HR', department: 'Human Resources', count: 2 },
  { code: 'ACC', department: 'Accounting', count: 2 },
];

export const APPROVAL_PERFORMANCE = {
  avgLeadDays: 4.7,
  overdue: 5,
  /** Approvals past their due date; `step` is the approval step the document is waiting at. */
  overdueItems: [
    { step: 1, code: 'IT-WI-012', title: 'Server Backup & Restore Instruction', role: 'Document Owner', name: 'Nattapong W.', days: 2 },
    { step: 3, code: 'IT-P-040', title: 'IT Involvement in Projects Procedure', role: 'Department Manager', name: 'Ronan R.', days: 6 },
    { step: 4, code: 'PD-P-007', title: 'Production Planning & Control Procedure', role: 'Document Controller', name: 'Siriporn K.', days: 12 },
    { step: 2, code: 'PD-WI-110', title: 'Compound Mixing Work Instruction', role: 'Section Manager', name: 'Somchai P.', days: 4 },
  ],
};

export type TaskTone = 'blue' | 'green' | 'violet' | 'orange';

export interface PendingTask {
  id: string;
  label: string;
  count: number;
  to: string;
  tone: TaskTone;
}

export const PENDING_TASKS: PendingTask[] = [
  { id: 't-1', label: 'Documents to review', count: 1, to: '/control/review', tone: 'blue' },
  { id: 't-2', label: 'Documents to approve', count: 4, to: '/control/approval', tone: 'green' },
  { id: 't-3', label: 'Documents to acknowledge', count: 2, to: '/control/acknowledgement', tone: 'violet' },
  { id: 't-4', label: 'Requiring revision', count: 0, to: '/my-documents', tone: 'orange' },
  { id: 't-5', label: 'Due for periodic review', count: 5, to: '/documents/expiring', tone: 'orange' },
];

export const ACKNOWLEDGEMENT_COMPLETION = 67;

export const DASHBOARD_FILTERS = [
  { key: 'department', label: 'Department', options: ['PD', 'QA', 'IT', 'ENG', 'SHE', 'PSD', 'HR', 'ACC'] },
  { key: 'type', label: 'Type', options: ['Procedure', 'Work Instruction', 'Form', 'Record', 'Standard'] },
  { key: 'status', label: 'Status', options: LIFECYCLE.map((s) => s.stage) },
  { key: 'product', label: 'Product', options: ['Anti-vibration', 'Air spring', 'Hose'] },
  { key: 'year', label: 'Year', options: ['2026', '2025', '2024'] },
] as const;
