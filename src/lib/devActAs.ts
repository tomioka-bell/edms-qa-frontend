import { api, ApiError } from './api';

/** A made-up test user a developer can act as. */
export interface ActAsUser {
  user_id: number;
  employee_code: string;
  display_name: string;
  position: string;
  department_code: string;
}

export interface ActAsState {
  /** Employee code of the test user being acted as; null when acting as yourself */
  acting_as: string | null;
  users: ActAsUser[];
}

const BASE = '/api/dev/act-as';

/**
 * Whether acting as a test user is available here, and its current state. The backend only has
 * this outside production with ALLOW_ACT_AS_MOCK_USER=true; anywhere else the answer is null.
 */
export async function getActAs(): Promise<ActAsState | null> {
  try {
    const res = await api<{ data: ActAsState }>(BASE);
    return res.data;
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
}

export async function startActAs(employeeCode: string): Promise<void> {
  await api(BASE, { method: 'POST', body: JSON.stringify({ employee_code: employeeCode }) });
}

export async function stopActAs(): Promise<void> {
  await api(BASE, { method: 'DELETE' });
}
