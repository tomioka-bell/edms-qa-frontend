import { Dropdown, Popconfirm } from 'antd';
import { Archive, ChevronDown, Download, UserRoundCog, X } from 'lucide-react';

interface Props {
  count: number;
  onClear: () => void;
  onAction: (action: string) => void;
}

/** Appears above the table when rows are selected. Replaces the toolbar's quiet state. */
export default function BulkActionBar({ count, onClear, onAction }: Props) {
  return (
    <div className="anim-fade flex flex-wrap items-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2.5 sm:px-5">
      <div className="flex items-center gap-2">
        <span className="tnum flex h-[22px] min-w-[22px] items-center justify-center rounded-md bg-brand-500 px-1.5 text-[11.5px] font-bold text-white">
          {count}
        </span>
        <p className="text-[13px] font-medium text-brand-700">
          {count === 1 ? 'document selected' : 'documents selected'}
        </p>
      </div>

      <span className="h-5 w-px bg-brand-200" />

      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'S. Tanaka', label: 'S. Tanaka' },
              { key: 'N. Somchai', label: 'N. Somchai' },
              { key: 'P. Kanya', label: 'P. Kanya' },
              { key: 'A. Wichai', label: 'A. Wichai' },
            ],
            onClick: ({ key }) => onAction(`Owner changed to ${key} for ${count} documents.`),
          }}
        >
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-brand-400 hover:text-ink"
          >
            <UserRoundCog size={14} strokeWidth={1.9} />
            Change Owner
            <ChevronDown size={13} className="text-faint" />
          </button>
        </Dropdown>

        <button
          type="button"
          onClick={() => onAction(`Exporting ${count} documents…`)}
          className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-brand-400 hover:text-ink"
        >
          <Download size={14} strokeWidth={1.9} />
          Export
        </button>

        <Popconfirm
          title="Archive selected documents?"
          description={`${count} documents will be moved to the archive and marked obsolete.`}
          okText="Archive"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
          onConfirm={() => onAction(`${count} documents archived.`)}
        >
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-brand-400 hover:text-brand-700"
          >
            <Archive size={14} strokeWidth={1.9} />
            Archive
          </button>
        </Popconfirm>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
      >
        <X size={13.5} />
        Clear selection
      </button>
    </div>
  );
}
