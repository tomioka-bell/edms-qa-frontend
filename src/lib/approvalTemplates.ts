import { api } from './api';
import type { ApprovalStepType, ApprovalTemplate, ApprovalTemplateInput, DirectoryUser } from '../types/approval';

const BASE = '/api/approval-template';

export async function listApprovalTemplates(): Promise<ApprovalTemplate[]> {
  const res = await api<{ data: ApprovalTemplate[] }>(`${BASE}/get-all`);
  return res.data;
}

export async function createApprovalTemplate(input: ApprovalTemplateInput): Promise<ApprovalTemplate> {
  const res = await api<{ data: ApprovalTemplate }>(`${BASE}/create`, { method: 'POST', body: JSON.stringify(input) });
  return res.data;
}

export async function updateApprovalTemplate(id: number, input: ApprovalTemplateInput): Promise<ApprovalTemplate> {
  const res = await api<{ data: ApprovalTemplate }>(`${BASE}/update/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.data;
}

export async function deleteApprovalTemplate(id: number): Promise<void> {
  await api(`${BASE}/delete/${id}`, { method: 'DELETE' });
}

/** Active people who can be named as approvers. */
export async function listApproverCandidates(): Promise<DirectoryUser[]> {
  const res = await api<{ data: DirectoryUser[] }>('/api/user-directory/users?active=1');
  return res.data;
}

/** Kinds of step that can be chosen for a new or edited template. */
export async function listActiveStepTypes(): Promise<ApprovalStepType[]> {
  const res = await api<{ data: ApprovalStepType[] }>('/api/approval-step-type/get-all?active=1');
  return res.data;
}

// ---------- step types (what a step asks for: review, approve, ...) ----------

const STEP_TYPES = '/api/approval-step-type';

/** Every step type, including inactive ones, in display order. */
export async function listStepTypes(): Promise<ApprovalStepType[]> {
  const res = await api<{ data: ApprovalStepType[] }>(`${STEP_TYPES}/get-all`);
  return res.data;
}

/** Adds a step type. The backend generates its code from the English name and puts it last in the list. */
export async function createStepType(input: { name_en: string; name_th: string }): Promise<ApprovalStepType> {
  const res = await api<{ data: ApprovalStepType }>(`${STEP_TYPES}/create`, { method: 'POST', body: JSON.stringify(input) });
  return res.data;
}

export async function updateStepType(
  id: number,
  input: { code: string; name_en: string; name_th: string; is_active: boolean },
): Promise<ApprovalStepType> {
  const res = await api<{ data: ApprovalStepType }>(`${STEP_TYPES}/update/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.data;
}

export async function deleteStepType(id: number): Promise<void> {
  await api(`${STEP_TYPES}/delete/${id}`, { method: 'DELETE' });
}
