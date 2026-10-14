import { api } from './api';

/** Someone allowed to maintain templates, suppliers and this list. */
export interface Administrator {
  /** 0 for a first administrator, who is set on the server and not on the list */
  admin_id: number;
  employee_code: string;
  name: string;
  department_code: string;
  /** A first administrator: cannot be removed here */
  fixed: boolean;
  created_by: string;
  created_at: string;
}

const BASE = '/api/access/admins';

export async function listAdministrators(): Promise<Administrator[]> {
  const res = await api<{ data: Administrator[] }>(BASE);
  return res.data;
}

export async function addAdministrator(userId: number): Promise<Administrator> {
  const res = await api<{ data: Administrator }>(BASE, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
  return res.data;
}

export async function removeAdministrator(adminId: number): Promise<void> {
  await api(`${BASE}/${adminId}`, { method: 'DELETE' });
}
