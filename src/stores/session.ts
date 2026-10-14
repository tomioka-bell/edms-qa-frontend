import { create } from 'zustand';
import { AuthError, getMe, USE_GATEWAY_AUTH, type Me } from '../lib/auth';
import { currentUser as mockUser } from '../data/mockActivities';

/** Where the signed-in user's details stand: not asked yet / being fetched / known / the backend could not be reached. */
type UserStatus = 'idle' | 'loading' | 'ready' | 'offline';

interface SessionState {
  /** The signed-in user, from the EDMS session. Null until loaded. */
  user: Me | null;
  status: UserStatus;
  /** True once the backend has refused the session and it could not be refreshed. */
  expired: boolean;
  /** Fetches the signed-in user once; later calls do nothing unless `force` is set. */
  loadUser: (force?: boolean) => Promise<void>;
  setUser: (user: Me) => void;
  /** Called on a 401 that a refresh did not fix. */
  expire: () => void;
}

/**
 * The EDMS session: who is signed in and whether the session is still good. Lives outside React so
 * the API layer can flag an expired session from any request; SessionWatcher reacts by signing the user out.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  status: 'idle',
  expired: false,
  loadUser: async (force = false) => {
    const { status } = get();
    if (status === 'loading' || (status === 'ready' && !force)) return;
    set({ status: 'loading' });
    try {
      set({ user: await getMe(), status: 'ready' });
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) set({ user: null, status: 'idle', expired: true });
      else set({ status: 'offline' }); // backend not running or unreachable: not a reason to sign anyone out
    }
  },
  setUser: (user) => set({ user, status: 'ready' }),
  expire: () => set({ expired: true, user: null }),
}));

/** The signed-in user as the screens show them. */
export interface CurrentUser {
  name: string;
  firstName: string;
  initials: string;
  email: string;
  employeeCode: string;
  /** Department code, e.g. "QA"; empty when unknown. */
  department: string;
  isSuperAdmin: boolean;
  /** False while loading, and for the stand-in used when running without a backend. */
  signedIn: boolean;
}

const LOADING_USER: CurrentUser = {
  name: '…',
  firstName: '',
  initials: '',
  email: '',
  employeeCode: '',
  department: '',
  isSuperAdmin: false,
  signedIn: false,
};

// Running QA on its own in dev, with no backend to ask: keep the demo user so the screens are not blank
const STANDALONE_USER: CurrentUser = {
  ...LOADING_USER,
  name: mockUser.name,
  firstName: mockUser.firstName,
  initials: mockUser.initials,
  email: mockUser.email,
};

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}

function toCurrentUser(me: Me): CurrentUser {
  const name = me.display_name.trim() || me.username;
  return {
    name,
    firstName: name.split(/\s+/)[0] ?? name,
    initials: initialsOf(name),
    email: me.email,
    employeeCode: me.employee_code,
    department: me.department_code,
    isSuperAdmin: me.is_super_admin ?? false,
    signedIn: true,
  };
}

/** The signed-in user, ready to show. */
export function useCurrentUser(): CurrentUser {
  const user = useSessionStore((s) => s.user);
  const status = useSessionStore((s) => s.status);
  if (user) return toCurrentUser(user);
  if (status === 'offline' && !USE_GATEWAY_AUTH) return STANDALONE_USER;
  return LOADING_USER;
}
