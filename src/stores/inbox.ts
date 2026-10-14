import { create } from 'zustand';
import { listDocumentRequests } from '../lib/documentRequests';

interface InboxState {
  /** How many requests are waiting for the signed-in person's decision; null until first counted. */
  count: number | null;
  /** How many of the signed-in person's own requests were sent back and wait to be fixed; null until first counted. */
  returned: number | null;
  /** Counts again. Called when the app opens and after anything that changes the numbers. */
  refresh: () => Promise<void>;
  setCount: (count: number) => void;
  setReturned: (returned: number) => void;
}

/**
 * The numbers shown in the menu beside "My Tasks" and "Returned Documents": the two lists of things
 * waiting for the signed-in person. Shared so every screen that changes them can update them.
 */
export const useInboxStore = create<InboxState>((set) => ({
  count: null,
  returned: null,
  refresh: async () => {
    try {
      const [inbox, mine] = await Promise.all([listDocumentRequests('inbox'), listDocumentRequests('mine')]);
      set({ count: inbox.length, returned: mine.filter((r) => r.status === 'RETURNED').length });
    } catch {
      // Keep whatever was shown: a failed count is not worth an error on every page
    }
  },
  setCount: (count) => set({ count }),
  setReturned: (returned) => set({ returned }),
}));
