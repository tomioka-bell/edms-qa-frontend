import { api } from './api';
import type { Supplier, SupplierInput } from '../types/supplier';

const BASE = '/api/supplier';

export async function listSuppliers(): Promise<Supplier[]> {
  const res = await api<{ data: Supplier[] }>(`${BASE}/get-all`);
  return res.data;
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const res = await api<{ data: Supplier }>(`${BASE}/create`, { method: 'POST', body: JSON.stringify(input) });
  return res.data;
}

export async function updateSupplier(id: number, input: SupplierInput): Promise<Supplier> {
  const res = await api<{ data: Supplier }>(`${BASE}/update/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return res.data;
}

export async function deleteSupplier(id: number): Promise<void> {
  await api(`${BASE}/delete/${id}`, { method: 'DELETE' });
}
