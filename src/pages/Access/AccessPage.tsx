import { useEffect, useState } from 'react';
import { App as AntApp, Select, Spin, Tooltip } from 'antd';
import { Lock, Plus, RotateCw, ServerCrash, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { ApiError } from '../../lib/api';
import { addAdministrator, listAdministrators, removeAdministrator, type Administrator } from '../../lib/access';
import { listApproverCandidates } from '../../lib/approvalTemplates';
import type { DirectoryUser } from '../../types/approval';
import { useCurrentUser } from '../../stores/session';
import { dayjs } from '../../lib/format';

/** Who may maintain the templates, suppliers and settings everyone else only uses. */
export default function AccessPage() {
  const { message, modal } = AntApp.useApp();
  const me = useCurrentUser();

  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [choice, setChoice] = useState<number | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAdministrators(), listApproverCandidates().catch(() => [] as DirectoryUser[])])
      .then(([list, people]) => {
        if (cancelled) return;
        setAdmins(list);
        setUsers(people);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err : new ApiError(0, 'Could not load the administrators.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const add = async () => {
    if (choice === undefined) return;
    setAdding(true);
    try {
      const added = await addAdministrator(choice);
      setAdmins((list) => [...list, added]);
      setChoice(undefined);
      message.success(`${added.name} is now an administrator.`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Could not add the administrator.');
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = (admin: Administrator) => {
    modal.confirm({
      title: `Remove ${admin.name}?`,
      content: <p className="text-[13.5px] text-muted">They will no longer be able to change templates, suppliers or this list. They can still create and approve documents.</p>,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await removeAdministrator(admin.admin_id);
          setAdmins((list) => list.filter((a) => a.admin_id !== admin.admin_id));
          message.success(`${admin.name} removed.`);
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Could not remove the administrator.');
        }
      },
    });
  };

  // People who can still be added: real users who are not administrators already
  const taken = new Set(admins.map((a) => a.employee_code.toLowerCase()));
  const options = users
    .filter((u) => u.employee_code && !taken.has(u.employee_code.toLowerCase()) && !u.is_mock)
    .map((u) => ({
      value: u.user_id,
      label: `${u.display_name} · ${u.employee_code}`,
      search: `${u.display_name} ${u.username} ${u.employee_code} ${u.position} ${u.department_code}`.toLowerCase(),
    }));

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Administration"
        title="Access"
        description="Administrators maintain document templates, approval templates, step types, suppliers and this list. Everyone else can create and approve documents."
      />

      <div className="anim-rise panel mt-6 max-w-3xl overflow-hidden">
        {loadError ? (
          <EmptyState
            icon={<ServerCrash size={19} strokeWidth={1.75} />}
            title="The administrators could not be loaded"
            description={loadError.message}
            action={
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setReloadKey((k) => k + 1);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                <RotateCw size={14} />
                Try again
              </button>
            }
          />
        ) : loading ? (
          <div className="grid h-40 place-items-center">
            <Spin />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <label htmlFor="new-admin" className="block text-[13px] font-medium text-ink-2">
                  Add an administrator
                </label>
                <Select
                  id="new-admin"
                  value={choice}
                  onChange={setChoice}
                  allowClear
                  showSearch={{
                    filterOption: (input, option) => ((option as { search?: string } | undefined)?.search ?? '').includes(input.toLowerCase()),
                  }}
                  placeholder="Search by name or employee code"
                  options={options}
                  disabled={adding}
                  className="mt-1.5 w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => void add()}
                disabled={choice === undefined || adding}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus size={15} strokeWidth={2.4} />
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>

            <ul className="divide-y divide-line" aria-label="Administrators">
              {admins.map((admin) => {
                const self = admin.employee_code.toLowerCase() === me.employeeCode.toLowerCase();
                return (
                  <li key={`${admin.admin_id}-${admin.employee_code}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                        <span className="truncate">{admin.name}</span>
                        {self && <span className="shrink-0 rounded bg-brand-50 px-1.5 py-px text-[10.5px] font-semibold text-brand-700">You</span>}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        <span className="doc-code text-[11.5px]">{admin.employee_code}</span>
                        {admin.department_code && ` · ${admin.department_code}`}
                        {!admin.fixed && admin.created_at && ` · added ${dayjs(admin.created_at).format('DD MMM YYYY')} by ${admin.created_by}`}
                      </p>
                    </div>
                    {admin.fixed ? (
                      <Tooltip title="A first administrator, set on the server. Cannot be removed here.">
                        <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted">
                          <Lock size={12} />
                          First administrator
                        </span>
                      </Tooltip>
                    ) : (
                      !self && (
                        <Tooltip title="Remove">
                          <button
                            type="button"
                            onClick={() => confirmRemove(admin)}
                            aria-label={`Remove ${admin.name}`}
                            className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger-strong"
                          >
                            <Trash2 size={15} />
                          </button>
                        </Tooltip>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-line bg-[#FAFAFB] px-4 py-2.5 text-[12px] text-muted">
              Super admins of the EDMS portal are administrators here as well; they are managed in the portal and not listed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
