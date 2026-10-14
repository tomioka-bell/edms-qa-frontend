import { DatePicker, Select, Tooltip } from 'antd';
import { Search, SlidersHorizontal, X, LayoutGrid, Rows3, RotateCcw } from 'lucide-react';
import type { DocCategory, DocStatus, Department } from '../../types/document';
import { owners } from '../../data/mockActivities';
import { fmtNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

const CATEGORIES: DocCategory[] = [
  'Procedure',
  'Work Instruction',
  'Standard',
  'Form',
  'Manual',
  'Specification',
  'Record',
];
const DEPARTMENTS: Department[] = [
  'QA',
  'Production',
  'Engineering',
  'Warehouse',
  'Purchasing',
  'Maintenance',
];
const STATUSES: DocStatus[] = [
  'Draft',
  'Under Review',
  'Pending Approval',
  'Active',
  'Expiring Soon',
  'Expired',
  'Archived',
];

export interface Filters {
  query: string;
  category?: DocCategory;
  department?: Department;
  owner?: string;
  status?: DocStatus;
  effectiveFrom?: string;
  revision?: string;
}

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
  density: 'comfortable' | 'compact';
  onDensityChange: (d: 'comfortable' | 'compact') => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

const selectCls = 'min-w-[132px]';

export default function FilterBar({
  filters,
  onChange,
  onReset,
  resultCount,
  totalCount,
  density,
  onDensityChange,
  showAdvanced,
  onToggleAdvanced,
}: Props) {
  const activeCount = [
    filters.category,
    filters.department,
    filters.owner,
    filters.status,
    filters.effectiveFrom,
    filters.revision,
  ].filter(Boolean).length;

  const filtered = resultCount !== totalCount || filters.query.trim() !== '';

  return (
    <div className="border-b border-line bg-surface">
      {/* Row 1 — search, filters, view controls */}
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 sm:px-5">
        {/* Search */}
        <div className="relative min-w-60 flex-1 lg:max-w-95">
          <Search
            size={15.5}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Search document code or document name…"
            className="h-9 w-full rounded-lg border border-line bg-[#FAFAFB] pr-8 pl-9 text-[13.5px] text-ink transition-colors outline-none placeholder:text-faint hover:border-[#D4D4D8] focus:border-brand-500 focus:bg-surface focus:ring-[3px] focus:ring-brand-500/10"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => onChange({ query: '' })}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-faint transition-colors hover:bg-line-soft hover:text-ink"
            >
              <X size={13.5} />
            </button>
          )}
        </div>

        <span className="hidden h-6 w-px bg-line lg:block" />

        <Select
          allowClear
          value={filters.category}
          onChange={(v) => onChange({ category: v })}
          placeholder="Category"
          className={selectCls}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Select
          allowClear
          value={filters.department}
          onChange={(v) => onChange({ department: v })}
          placeholder="Department"
          className={selectCls}
          options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
        />
        <Select
          allowClear
          showSearch
          value={filters.owner}
          onChange={(v) => onChange({ owner: v })}
          placeholder="Owner"
          className={selectCls}
          options={owners.map((o) => ({ value: o, label: o }))}
        />
        <Select
          allowClear
          value={filters.status}
          onChange={(v) => onChange({ status: v })}
          placeholder="Status"
          className={selectCls}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />

        <button
          type="button"
          onClick={onToggleAdvanced}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors',
            showAdvanced || activeCount > 0
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-line bg-surface text-ink-2 hover:border-[#D4D4D8] hover:bg-[#FAFAFB]',
          )}
        >
          <SlidersHorizontal size={14.5} strokeWidth={1.95} />
          More Filters
          {activeCount > 0 && (
            <span className="tnum ml-0.5 rounded-[4px] bg-brand-500 px-1 text-[10.5px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>

        {/* View density */}
        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-line bg-[#FAFAFB] p-0.75">
          <Tooltip title="Comfortable rows">
            <button
              type="button"
              onClick={() => onDensityChange('comfortable')}
              aria-label="Comfortable density"
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                density === 'comfortable'
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-faint hover:text-ink-2',
              )}
            >
              <LayoutGrid size={14.5} strokeWidth={1.9} />
            </button>
          </Tooltip>
          <Tooltip title="Compact rows">
            <button
              type="button"
              onClick={() => onDensityChange('compact')}
              aria-label="Compact density"
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                density === 'compact' ? 'bg-surface text-ink shadow-card' : 'text-faint hover:text-ink-2',
              )}
            >
              <Rows3 size={14.5} strokeWidth={1.9} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Row 2 — advanced filters */}
      {showAdvanced && (
        <div className="anim-fade flex flex-wrap items-end gap-4 border-t border-line-soft bg-[#FCFCFD] px-4 py-3.5 sm:px-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-muted">Effective Date (from)</span>
            <DatePicker
              format="DD MMM YYYY"
              className="w-43"
              onChange={(d) => onChange({ effectiveFrom: d ? d.toISOString() : undefined })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-muted">Revision</span>
            <Select
              allowClear
              value={filters.revision}
              onChange={(v) => onChange({ revision: v })}
              placeholder="Any revision"
              className="w-43"
              options={[
                { value: 'initial', label: 'Initial issue (Rev. 01)' },
                { value: 'low', label: 'Rev. 02 – 05' },
                { value: 'mid', label: 'Rev. 06 – 10' },
                { value: 'high', label: 'Rev. 11 and above' },
              ]}
            />
          </label>

          <button
            type="button"
            onClick={onReset}
            className="mb-px flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink"
          >
            <RotateCcw size={14} />
            Reset all
          </button>
        </div>
      )}

      {/* Row 3 — result count */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-4 py-2.5 sm:px-5">
        <p className="text-[12.5px] text-muted">
          <span className="tnum font-semibold text-ink">{fmtNumber(resultCount)}</span>{' '}
          {resultCount === 1 ? 'document' : 'documents'}
          {filtered && (
            <span className="text-faint"> · filtered from {fmtNumber(totalCount)}</span>
          )}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[12.5px] font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            <X size={12.5} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
