import { useEffect, useState } from 'react';
import { App as AntApp, Modal, Select } from 'antd';
import { FlaskConical, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { getActAs, startActAs, stopActAs, type ActAsState } from '../../lib/devActAs';
import { useCurrentUser } from '../../stores/session';
import { cn } from '../../lib/cn';

/**
 * Development only: lets the signed-in developer be seen as one of the made-up test users, to walk
 * an approval flow through from every approver's side. Renders nothing where the backend does not
 * offer it (production, or when it is not switched on).
 */
export default function ActAsSwitcher() {
  const { message } = AntApp.useApp();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<ActAsState | null>(null);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getActAs()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;
  const acting = state.acting_as !== null;

  // Everything on screen belongs to whoever is signed in, so the page is loaded again from scratch
  const change = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      window.location.reload();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Could not switch user.');
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setChoice(state.acting_as ?? undefined);
          setOpen(true);
        }}
        aria-label={acting ? `Testing as ${currentUser.name}. Change test user` : 'Test as another user'}
        title={acting ? `Testing as ${currentUser.name}` : 'Test as another user (development only)'}
        className={cn(
          'flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
          acting
            ? 'border-[#FDE68A] bg-warn-soft text-[#A16207] hover:bg-[#FEF9C3]'
            : 'border-line bg-surface text-ink-2 hover:border-[#D4D4D8] hover:bg-[#FAFAFB]',
        )}
      >
        <FlaskConical size={15} />
        <span className="hidden max-w-44 truncate md:inline">{acting ? `Testing as ${currentUser.name}` : 'Test as…'}</span>
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        width={460}
        centered
        closable={false}
        footer={null}
        styles={{ body: { padding: 0 } }}
        classNames={{ container: '!p-0 overflow-hidden' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Development only</p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.018em]">Test as another user</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="-mt-1 -mr-1.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[#F4F4F5] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[13px] leading-relaxed text-ink-2">
            See the system as one of the made-up test users: their tasks, their documents, their signature. You stay signed in as yourself
            underneath, and can switch back at any time.
          </p>
          <label htmlFor="act-as-user" className="mt-4 block text-[13px] font-medium text-ink-2">
            Test user
          </label>
          <Select
            id="act-as-user"
            value={choice}
            onChange={setChoice}
            showSearch={{
              filterOption: (input, option) => ((option as { search?: string } | undefined)?.search ?? '').includes(input.toLowerCase()),
            }}
            placeholder="Choose who to be"
            options={state.users.map((u) => ({
              value: u.employee_code,
              label: `${u.display_name} · ${u.employee_code}`,
              search: `${u.display_name} ${u.employee_code} ${u.position} ${u.department_code}`.toLowerCase(),
              user: u,
            }))}
            optionRender={(option) => {
              const { user } = option.data as { user: ActAsState['users'][number] };
              return (
                <div className="flex items-center justify-between gap-3 py-0.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{user.display_name}</span>
                    <span className="block truncate text-[11.5px] text-muted">{[user.position, user.department_code].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="doc-code shrink-0 text-[11px] text-faint">{user.employee_code}</span>
                </div>
              );
            }}
            className="mt-1.5 w-full"
          />
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            A test user has no signature until you set one: open My Signature while testing as them, then they can approve.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line bg-[#FAFAFB] px-6 py-4">
          {acting ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void change(stopActAs)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:opacity-60"
            >
              Back to myself
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={busy || !choice || choice === state.acting_as}
            onClick={() => choice && void change(() => startActAs(choice))}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? 'Switching…' : 'Switch'}
          </button>
        </div>
      </Modal>
    </>
  );
}
