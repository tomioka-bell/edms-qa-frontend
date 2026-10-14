import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { CalendarDays, Plus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryBlock from '../../components/dashboard/SummaryBlock';
import DocumentAnalytics from '../../components/dashboard/DocumentAnalytics';
import ComplianceTrend from '../../components/dashboard/ComplianceTrend';
import DocumentAlerts from '../../components/dashboard/DocumentAlerts';
import WorkloadOverview from '../../components/dashboard/WorkloadOverview';
import ApprovalPerformance from '../../components/dashboard/ApprovalPerformance';
import PendingTasks from '../../components/dashboard/PendingTasks';
import RecentDocuments from '../../components/dashboard/RecentDocuments';
import DocumentDetailDrawer from '../../components/documents/DocumentDetailDrawer';
import DocumentFormModal from '../../components/documents/DocumentFormModal';
import RevisionModal from '../../components/documents/RevisionModal';
import { mockDocuments } from '../../data/mockDocuments';
import { useCurrentUser } from '../../stores/session';
import type { QaDocument } from '../../types/document';
import { TODAY, fmtLongDate } from '../../lib/format';

const RECENT_IDS = ['d-001', 'd-002', 'd-003', 'd-004', 'd-020', 'd-014'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<QaDocument | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [revisionDoc, setRevisionDoc] = useState<QaDocument | null>(null);

  // Brief skeleton pass so the screen reads as a real data fetch.
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 550);
    return () => window.clearTimeout(t);
  }, []);

  const recent = RECENT_IDS.map((id) => mockDocuments.find((d) => d.id === id)!).filter(Boolean);

  const openDoc = (doc: QaDocument) => {
    setActive(doc);
    setDrawerOpen(true);
  };

  const greeting = TODAY.hour() < 12 ? 'Good morning' : TODAY.hour() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="QA Documentation"
        title={currentUser.firstName ? `${greeting}, ${currentUser.firstName}` : greeting}
        description="Here's what needs your attention today."
        meta={
          <span className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.75 text-[13px] text-ink-2 sm:flex">
            <CalendarDays size={14.5} className="text-faint" />
            <span className="tnum">{fmtLongDate()}</span>
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2.25 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-600 active:bg-brand-700"
          >
            <Plus size={16} strokeWidth={2.4} />
            New Document
          </button>
        }
      />

      <div className="anim-rise mt-6 flex flex-col gap-5">
        <SummaryBlock onDrill={(status) => navigate('/documents', { state: { status } })} />

        {/* Overview grid: analytics, trend and alerts, then workload, approvals and my tasks */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <DocumentAnalytics />
          <ComplianceTrend />
          <DocumentAlerts />
          <WorkloadOverview />
          <ApprovalPerformance />
          <PendingTasks />
        </div>

        {/* Reference: the latest additions to the register */}
        <RecentDocuments
          docs={recent}
          loading={loading}
          onOpen={openDoc}
          onViewAll={() => navigate('/documents')}
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
