import { useEffect } from 'react';
import { create } from 'zustand';
import { api, ApiError } from '../lib/api';
import { useSessionStore } from './session';

interface AccessState {
  /** Whether the signed-in person is an administrator. Null until the server has said. */
  isAdmin: boolean | null;
  /** Whose answer `isAdmin` is, so a change of user (or of test user) asks again */
  employeeCode: string;
  load: (employeeCode: string) => Promise<void>;
}

/**
 * What the signed-in person may do in this application. Only used to show or hide things: the
 * server checks again on every call, so nothing here grants anything.
 */
export const useAccessStore = create<AccessState>((set, get) => ({
  isAdmin: null,
  employeeCode: '',
  load: async (employeeCode) => {
    if (get().employeeCode === employeeCode) return;
    set({ employeeCode, isAdmin: null });
    try {
      const res = await api<{ data: { is_admin: boolean } }>('/api/access/me');
      if (get().employeeCode === employeeCode) set({ isAdmin: res.data.is_admin });
    } catch (err) {
      if (get().employeeCode !== employeeCode) return;
      // A backend from before administrators existed restricts nothing: show everything, as it did
      set({ isAdmin: err instanceof ApiError && err.status === 404 });
    }
  },
}));

/** Whether the signed-in person is an administrator; null while that is not known yet. */
export function useIsAdmin(): boolean | null {
  const employeeCode = useSessionStore((s) => s.user?.employee_code ?? '');
  const isAdmin = useAccessStore((s) => s.isAdmin);
  const known = useAccessStore((s) => s.employeeCode);
  const load = useAccessStore((s) => s.load);
  useEffect(() => {
    if (employeeCode) void load(employeeCode);
  }, [employeeCode, load]);
  return employeeCode && known === employeeCode ? isAdmin : null;
}
