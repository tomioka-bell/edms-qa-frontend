/** Who approves a step: people named in the template, or people picked when a document is submitted. */
export type ApproverType = 'USER' | 'REQUESTER_SELECT';

/**
 * When a step with several approvers counts as passed: one approval is enough, or everyone must approve.
 * A rejection by anyone sends the document back at once under either rule.
 */
export type ApprovalRule = 'ANY_ONE' | 'ALL';

/** A person named as an approver of a step, as they were when the template was saved. */
export interface StepApprover {
  user_id: number;
  employee_code: string;
  name: string;
  position: string;
  department_code: string;
}

/** A kind of approval step (review, approve, acknowledge, ...) from the step type master table. */
export interface ApprovalStepType {
  step_type_id: number;
  code: string;
  name_en: string;
  name_th: string;
  sort_order: number;
  is_active: boolean;
}

export interface ApprovalTemplateStep {
  step_id: number;
  step_no: number;
  step_type_id: number | null;
  step_type_code: string;
  /** The step type's name when the template was saved */
  step_name: string;
  approver_type: ApproverType;
  approval_rule: ApprovalRule;
  /** Days the approvers have to decide once a document reaches the step; 0 for no limit */
  due_days: number;
  /** Empty when approver_type is REQUESTER_SELECT */
  approvers: StepApprover[];
}

export interface ApprovalTemplate {
  template_id: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  step_count: number;
  steps: ApprovalTemplateStep[];
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

/**
 * Body of a create / update request. Steps are numbered by their position in the array.
 * `is_active` is not sent: the backend makes new templates active and leaves existing ones as they are.
 */
export interface ApprovalTemplateInput {
  code: string;
  name: string;
  description: string;
  steps: Array<{
    step_type_id: number;
    approver_type: ApproverType;
    approval_rule: ApprovalRule;
    approver_user_ids: number[];
    /** 0 for no limit */
    due_days: number;
  }>;
}

/** A person from the organization's user directory. */
export interface DirectoryUser {
  user_id: number;
  username: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  position: string;
  department_id: number | null;
  department_code: string;
  department_name_th: string;
  department_name_en: string;
  manager_id: number | null;
  manager_name: string;
  is_active: boolean;
  /** Made-up test user that exists only outside production */
  is_mock: boolean;
}
