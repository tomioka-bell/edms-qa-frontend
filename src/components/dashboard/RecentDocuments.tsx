import { Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { QaDocument } from '../../types/document';
import StatusBadge from '../common/StatusBadge';
import { CategoryTag } from '../common/CategoryTag';
import { fmtDate, revLabel } from '../../lib/format';

interface Props {
  docs: QaDocument[];
  loading?: boolean;
  onOpen: (doc: QaDocument) => void;
  onViewAll: () => void;
}

export default function RecentDocuments({ docs, loading, onOpen, onViewAll }: Props) {
  const columns: ColumnsType<QaDocument> = [
    {
      title: 'Document',
      dataIndex: 'code',
      width: 230,
      render: (_, d) => (
        <button type="button" onClick={() => onOpen(d)} className="group block max-w-full text-left">
          <span className="doc-code block text-brand-600 transition-colors group-hover:text-brand-700">
            {d.code}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium text-ink group-hover:underline group-hover:decoration-line group-hover:underline-offset-2">
              {d.name}
            </span>
            <ExternalLink
              size={12}
              className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
        </button>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 138,
      responsive: ['xxl'],
      render: (v) => <CategoryTag value={v} />,
    },
    {
      title: 'Revision',
      dataIndex: 'revision',
      width: 76,
      align: 'right',
      render: (v: number) => <span className="tnum text-[13px] text-ink-2">{revLabel(v)}</span>,
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      width: 104,
      render: (v) => <span className="text-[13px] whitespace-nowrap text-ink-2">{v}</span>,
    },
    {
      title: 'Effective Date',
      dataIndex: 'effectiveDate',
      width: 118,
      responsive: ['xxl'],
      render: (v) => (
        <span className="tnum text-[13px] whitespace-nowrap text-ink-2">{fmtDate(v)}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: '',
      key: 'action',
      width: 56,
      align: 'right',
      render: (_, d) => (
        <Tooltip title="Open details">
          <button
            type="button"
            onClick={() => onOpen(d)}
            aria-label={`Open ${d.code}`}
            className="flex size-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-[#F4F4F5] hover:text-ink"
          >
            <ArrowRight size={15} strokeWidth={1.9} />
          </button>
        </Tooltip>
      ),
    },
  ];

  return (
    <section className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Recent Documents</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Latest additions and revisions to the register</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
        >
          View all
          <ArrowRight size={13} />
        </button>
      </div>

      <Table<QaDocument>
        rowKey="id"
        columns={columns}
        dataSource={docs}
        loading={loading}
        pagination={false}
        scroll={{ x: 606 }}
        onRow={() => ({ className: 'cursor-default' })}
      />
    </section>
  );
}
