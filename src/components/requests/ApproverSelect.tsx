import { Select } from 'antd';
import type { DirectoryUser } from '../../types/approval';

interface Props {
  value: number[];
  onChange: (userIds: number[]) => void;
  /** People who can be chosen. */
  users: DirectoryUser[];
  loading?: boolean;
  /** People already chosen who may no longer be in `users`; keeps them readable instead of a bare id. */
  known?: Array<{ user_id: number; name: string }>;
  /** People already on another step: shown, but not selectable, because nobody is asked twice. */
  taken?: Set<number>;
  ariaLabel: string;
  status?: 'error';
}

/** Picks one or more people from the user directory, searchable by name, employee code or department. */
export default function ApproverSelect({ value, onChange, users, loading, known = [], taken, ariaLabel, status }: Props) {
  const options = [
    ...users.map((u) => ({
      value: u.user_id,
      label: u.display_name,
      search: `${u.display_name} ${u.first_name} ${u.last_name} ${u.username} ${u.employee_code} ${u.position} ${u.department_code}`.toLowerCase(),
      user: u as DirectoryUser | null,
      disabled: taken?.has(u.user_id) && !value.includes(u.user_id),
    })),
    ...known
      .filter((k) => !users.some((u) => u.user_id === k.user_id))
      .map((k) => ({ value: k.user_id, label: k.name, search: k.name.toLowerCase(), user: null as DirectoryUser | null, disabled: false })),
  ];

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={onChange}
      status={status}
      showSearch={{
        filterOption: (input, option) => ((option as { search?: string } | undefined)?.search ?? '').includes(input.toLowerCase()),
      }}
      allowClear
      loading={loading}
      placeholder="Type a name, employee code, or department"
      aria-label={ariaLabel}
      options={options}
      className="w-full"
      optionRender={(option) => {
        const { user, disabled } = option.data as { user: DirectoryUser | null; disabled?: boolean };
        if (!user) return option.label;
        return (
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{user.display_name}</span>
              <span className="block truncate text-[11.5px] text-muted">
                {disabled ? 'Already on another step' : [user.position, user.department_name_en || user.department_code].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="doc-code shrink-0 text-[11px] text-faint">{user.employee_code}</span>
          </div>
        );
      }}
    />
  );
}
