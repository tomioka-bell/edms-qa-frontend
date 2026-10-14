import { Dropdown, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import {
  Archive,
  Download,
  Eye,
  GitBranch,
  History,
  MoreHorizontal,
  Pencil,
  FileSearch,
} from 'lucide-react';
import type { QaDocument } from '../../types/document';
import StatusBadge from '../common/StatusBadge';
import { CategoryTag } from '../common/CategoryTag';
import EmptyState from '../common/EmptyState';
import { fmtDate, revLabel, daysUntil } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Props {
  docs: QaDocument[];
  loading: boolean;
  density: 'comfortable' | 'compact';
  selectedKeys: React.Key[];
  onSelectionChange: (keys: React.Key[]) => void;
  onOpen: (doc: QaDocument) => void;
  onAction: (action: string, doc: QaDocument) => void;
  onResetFilters: () => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number, size: number) => void;
}

/** Next-review cell — colours only when the date is actually at risk. */
function NextReview({ date }: { date: string }) {
  const d = daysUntil(date);
  const tone = d < 0 ? 'text-danger-strong font-medium' : d <= 30 ? 'text-warn font-medium' : 'text-ink-2';
  return (
    <span className="flex flex-col">
      <span className={cn('tnum text-[13px] whitespace-nowrap', tone)}>{fmtDate(date)}</span>
      {d <= 30 && (
        <span className={cn('text-[11px]', d < 0 ? 'text-danger-strong' : 'text-warn')}>
          {d < 0 ? `${Math.abs(d)} days overdue` : `in ${d} days`}
        </span>
      )}
    </span>
  );
}

export default function DocumentTable({
  docs,
  loading,
  density,
  selectedKeys,
  onSelectionChange,
  onOpen,
  onAction,
  onResetFilters,
  page,
  pageSize,
  onPageChange,
}: Props) {
  const rowSelection: TableRowSelection<QaDocument> = {
    selectedRowKeys: selectedKeys,
    onChange: onSelectionChange,
    columnWidth: 44,
    preserveSelectedRowKeys: true,
  };

  const columns: ColumnsType<QaDocument> = [
    {
      title: 'Document',
      dataIndex: 'name',
      key: 'document',
      width: 276,
      ellipsis: true,
      sorter: (a, b) => a.code.localeCompare(b.code),
      defaultSortOrder: 'ascend',
      render: (_, d) => (
        <button type="button" onClick={() => onOpen(d)} className="group block w-full text-left">
          <span className="doc-code block text-brand-600 transition-colors group-hover:text-brand-700">
            {d.code}
          </span>
          <span className="mt-0.5 block truncate text-[13.5px] font-medium text-ink group-hover:underline group-hover:decoration-line group-hover:underline-offset-2">
            {d.name}
          </span>
          {/* Below md the Status column is dropped, so it rides along here. */}
          <span className="mt-1.5 block md:hidden">
            <StatusBadge status={d.status} size="sm" />
          </span>
        </button>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 140,
      responsive: ['lg'],
      sorter: (a, b) => a.category.localeCompare(b.category),
      render: (v) => <CategoryTag value={v} />,
    },
    {
      title: 'Dept.',
      dataIndex: 'department',
      width: 108,
      responsive: ['xxl'],
      sorter: (a, b) => a.department.localeCompare(b.department),
      render: (v) => <span className="text-[13px] text-ink-2">{v}</span>,
    },
    {
      title: 'Rev.',
      dataIndex: 'revision',
      width: 84,
      responsive: ['md'],
      align: 'right',
      sorter: (a, b) => a.revision - b.revision,
      render: (v: number) => <span className="tnum text-[13px] text-ink-2">{revLabel(v)}</span>,
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      width: 118,
      responsive: ['lg'],
      sorter: (a, b) => a.owner.localeCompare(b.owner),
      render: (v: string, d) => (
        <Tooltip title={d.ownerRole}>
          <span className="text-[13px] whitespace-nowrap text-ink-2">{v}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Effective',
      dataIndex: 'effectiveDate',
      width: 122,
      responsive: ['xxl'],
      sorter: (a, b) => a.effectiveDate.localeCompare(b.effectiveDate),
      render: (v) => (
        <span className="tnum text-[13px] whitespace-nowrap text-ink-2">{fmtDate(v)}</span>
      ),
    },
    {
      title: 'Next Review',
      dataIndex: 'nextReviewDate',
      width: 130,
      responsive: ['xl'],
      sorter: (a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate),
      render: (v) => <NextReview date={v} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 146,
      responsive: ['md'],
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 56,
      align: 'center',
      render: (_, d) => (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              { key: 'view', icon: <Eye size={14.5} />, label: 'View Document' },
              { key: 'edit', icon: <Pencil size={14.5} />, label: 'Edit Information' },
              { key: 'revision', icon: <GitBranch size={14.5} />, label: 'Create Revision' },
              { key: 'history', icon: <History size={14.5} />, label: 'Revision History' },
              { type: 'divider' },
              { key: 'download', icon: <Download size={14.5} />, label: 'Download' },
              { type: 'divider' },
              { key: 'archive', icon: <Archive size={14.5} />, label: 'Archive', danger: true },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              onAction(key, d);
            },
          }}
        >
          <button
            type="button"
            aria-label={`Actions for ${d.code}`}
            data-row-action
            onClick={(e) => e.stopPropagation()}
            className="flex size-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-line-soft hover:text-ink"
          >
            <MoreHorizontal size={16} />
          </button>
        </Dropdown>
      ),
    },
  ];

  return (
    <Table<QaDocument>
      rowKey="id"
      columns={columns}
      dataSource={docs}
      loading={loading}
      rowSelection={rowSelection}
      size={density === 'compact' ? 'small' : 'middle'}
      sticky={{ offsetHeader: 60 }}
      scroll={{ x: 1024 }}
      onRow={(d) => ({
        // Clicking a row opens its detail drawer, except inside the selection
        // cell or the action menu — those own their own behaviour.
        onClick: (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.ant-table-selection-column, .ant-dropdown, [data-row-action]')) return;
          onOpen(d);
        },
        className: 'cursor-pointer',
      })}
      locale={{
        emptyText: (
          <EmptyState
            icon={<FileSearch size={19} strokeWidth={1.75} />}
            title="No documents match your filters"
            description="Try a different search term, or clear the active filters to see the full register."
            compact
            action={
              <button
                type="button"
                onClick={onResetFilters}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
              >
                Clear all filters
              </button>
            }
          />
        ),
      }}
      pagination={{
        current: page,
        pageSize,
        onChange: onPageChange,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        showTotal: (total, range) => (
          <span className="tnum text-[12.5px] text-muted">
            {range[0]}–{range[1]} of {total}
          </span>
        ),
        className: 'px-5 !mb-0 py-3.5',
      }}
    />
  );
}
