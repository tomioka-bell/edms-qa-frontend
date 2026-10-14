import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { Download, Plus, Upload } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/documents/FilterBar';
import type { Filters } from '../../components/documents/FilterBar';
import DocumentTable from '../../components/documents/DocumentTable';
import BulkActionBar from '../../components/documents/BulkActionBar';
import DocumentDetailDrawer from '../../components/documents/DocumentDetailDrawer';
import DocumentFormModal from '../../components/documents/DocumentFormModal';
import RevisionModal from '../../components/documents/RevisionModal';
import { mockDocuments } from '../../data/mockDocuments';
import type { DocStatus, QaDocument } from '../../types/document';
import { dayjs } from '../../lib/format';

const EMPTY: Filters = { query: '' };

/** Revision buckets used by the advanced filter. */
const inRevisionBucket = (rev: number, bucket?: string) => {
  if (!bucket) return true;
  if (bucket === 'initial') return rev === 1;
  if (bucket === 'low') return rev >= 2 && rev <= 5;
  if (bucket === 'mid') return rev >= 6 && rev <= 10;
  return rev >= 11;
};

export default function DocumentControlPage() {
  const { state } = useLocation() as { state?: { status?: DocStatus; focusDoc?: string } };
  const { message, modal } = AntApp.useApp();

  const [filters, setFilters] = useState<Filters>({ ...EMPTY, status: state?.status });
  const [showAdvanced, setShowAdvanced] = useState(Boolean(state?.status));
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [active, setActive] = useState<QaDocument | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The command palette can deep-link into this page while it is already
  // mounted, so the drawer follows each new navigation state. Adjusting during
  // render (rather than in an effect) avoids a flash of the closed drawer.
  const [handledLink, setHandledLink] = useState<string | undefined>(undefined);
  if (state?.focusDoc && state.focusDoc !== handledLink) {
    const doc = mockDocuments.find((d) => d.id === state.focusDoc) ?? null;
    setHandledLink(state.focusDoc);
    setActive(doc);
    setDrawerOpen(doc !== null);
  }
  const [newOpen, setNewOpen] = useState(false);
  const [revisionDoc, setRevisionDoc] = useState<QaDocument | null>(null);

  // Initial skeleton pass.
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 550);
    return () => window.clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return mockDocuments.filter((d) => {
      if (q && !d.code.toLowerCase().includes(q) && !d.name.toLowerCase().includes(q)) return false;
      if (filters.category && d.category !== filters.category) return false;
      if (filters.department && d.department !== filters.department) return false;
      if (filters.owner && d.owner !== filters.owner) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.effectiveFrom && dayjs(d.effectiveDate).isBefore(dayjs(filters.effectiveFrom), 'day'))
        return false;
      if (!inRevisionBucket(d.revision, filters.revision)) return false;
      return true;
    });
  }, [filters]);


  // Any filter change returns to the first page.
  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(EMPTY);
    setPage(1);
  };

  const openDoc = (doc: QaDocument) => {
    setActive(doc);
    setDrawerOpen(true);
  };

  const handleRowAction = (action: string, doc: QaDocument) => {
    switch (action) {
      case 'view':
        openDoc(doc);
        break;
      case 'revision':
        setRevisionDoc(doc);
        break;
      case 'history':
        openDoc(doc);
        break;
      case 'download':
        message.success(`Downloading ${doc.file.name}`);
        break;
      case 'edit':
        message.info(`Edit form for ${doc.code} would open here.`);
        break;
      case 'archive':
        modal.confirm({
          title: `Archive ${doc.code}?`,
          content: (
            <p className="text-[13.5px] text-muted">
              {doc.name} will be marked obsolete and removed from the active register. Controlled
              copies must be withdrawn from all distribution points.
            </p>
          ),
          okText: 'Archive document',
          okButtonProps: { danger: true },
          cancelText: 'Cancel',
          onOk: () => message.success(`${doc.code} archived.`),
        });
        break;
    }
  };

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Document Control"
        title="Documentation Control"
        description="Manage controlled documents, revisions, ownership, and approval status."
        actions={
          <>
            <button
              type="button"
              onClick={() => message.info('Import from Excel or a controlled folder.')}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.25 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
            >
              <Upload size={15} strokeWidth={1.95} />
              Import
            </button>
            <button
              type="button"
              onClick={() => message.success(`Exporting ${filtered.length} documents to XLSX…`)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.25 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB]"
            >
              <Download size={15} strokeWidth={1.95} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2.25 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-600 active:bg-brand-700"
            >
              <Plus size={16} strokeWidth={2.4} />
              New Document
            </button>
          </>
        }
      />

      <div className="anim-rise panel mt-6 overflow-hidden">
        {selectedKeys.length > 0 ? (
          <BulkActionBar
            count={selectedKeys.length}
            onClear={() => setSelectedKeys([])}
            onAction={(summary) => {
              message.success(summary);
              setSelectedKeys([]);
            }}
          />
        ) : null}

        <FilterBar
          filters={filters}
          onChange={patchFilters}
          onReset={resetFilters}
          resultCount={filtered.length}
          totalCount={mockDocuments.length}
          density={density}
          onDensityChange={setDensity}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        />

        <DocumentTable
          docs={filtered}
          loading={loading}
          density={density}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onOpen={openDoc}
          onAction={handleRowAction}
          onResetFilters={resetFilters}
          page={page}
          pageSize={pageSize}
          onPageChange={(p, s) => {
            setPage(p);
            setPageSize(s);
          }}
        />
      </div>

      <DocumentDetailDrawer
        doc={active}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreateRevision={(doc) => {
          setDrawerOpen(false);
          setRevisionDoc(doc);
        }}
      />

      <DocumentFormModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(summary) => message.success(summary)}
      />

      <RevisionModal
        doc={revisionDoc}
        open={revisionDoc !== null}
        onClose={() => setRevisionDoc(null)}
        onCreated={(summary) => message.success(summary)}
      />
    </div>
  );
}
