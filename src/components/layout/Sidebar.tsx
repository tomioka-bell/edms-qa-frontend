import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  ListTodo,
  FileText,
  Library,
  Plus,
  Check,
  Clock,
  Ban,
  CircleCheck,
  Eye,
  UserCheck,
  Search,
  ChartColumn,
  ShieldCheck,
  Database,
  Settings,
  Signature,
  FileStack,
  Workflow,
  Building2,
  Cable,
  Truck,
  UserCog,
  ChevronDown,
  Undo2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Select, Tooltip } from 'antd';
import { LogoLockup, LogoMark } from './Logo';
import { useCurrentUser } from '../../stores/session';
import { useInboxStore } from '../../stores/inbox';
import { useIsAdmin } from '../../stores/access';
import { cn } from '../../lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Shown to administrators only */
  admin?: boolean;
  /** A short word shown instead of a count: the state of what the row leads to, such as a connection */
  status?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
      { to: '/tasks', label: 'My Tasks', icon: ListTodo }, // badge: the live count of requests waiting for the user
    ],
  },
  {
    title: 'Documents',
    items: [
      { to: '/my-documents', label: 'My Documents', icon: FileText },
      { to: '/documents', label: 'Document Library', icon: Library },
      { to: '/documents/new', label: 'Create Document', icon: Plus },
      { to: '/documents/returned', label: 'Returned Documents', icon: Undo2 }, // badge: the live count of documents sent back to the user
      { to: '/documents/released', label: 'Released Documents', icon: Check },
      { to: '/documents/expiring', label: 'Expiring Documents', icon: Clock },
      { to: '/documents/obsolete', label: 'Obsolete Documents', icon: Ban },
    ],
  },
  {
    title: 'Control',
    items: [
      { to: '/control/approval', label: 'Documents for Approval', icon: CircleCheck, badge: 4 },
      { to: '/control/review', label: 'Documents for Review', icon: Eye, badge: 1 },
      { to: '/control/acknowledgement', label: 'Document Acknowledgement', icon: UserCheck, badge: 2 },
      { to: '/search', label: 'Search', icon: Search },
      { to: '/reports', label: 'Reports', icon: ChartColumn },
      { to: '/audit-trail', label: 'Audit Trail', icon: ShieldCheck },
    ],
  },
  {
    title: 'Interface',
    items: [
      // TODO: fixed for now; read the real state of the link once the EDI connection exists
      { to: '/edi', label: 'EDI', icon: Cable, status: 'On' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/document-templates', label: 'Document Templates', icon: FileStack, admin: true },
      { to: '/approval-templates', label: 'Approval Templates', icon: Workflow, admin: true },
      { to: '/my-signature', label: 'My Signature', icon: Signature },
      { to: '/suppliers', label: 'Suppliers', icon: Truck, admin: true },
      { to: '/access', label: 'Access', icon: UserCog, admin: true },
      { to: '/master-data', label: 'Master Data', icon: Database },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ROLES = ['System Administrator', 'QA Manager', 'Document Controller', 'Approver', 'Viewer'];

function NavRow({ item, onNavigate, collapsed }: { item: NavItem; onNavigate?: () => void; collapsed?: boolean }) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      // My Tasks stays highlighted while one of its documents is open (/tasks/:id)
      end={item.to !== '/tasks'}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex min-h-10 items-center gap-3 rounded-lg py-2 text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 motion-reduce:transition-none',
          collapsed ? 'justify-center px-0' : 'px-3',
          // `!` — AntD's unlayered `a { color: colorLink; background-color: transparent }` reset otherwise wins over utilities.
          isActive
            ? 'bg-brand-50! font-semibold text-ink! shadow-[inset_0_0_0_1px_var(--color-brand-100)]'
            : 'font-medium text-ink-2! hover:bg-[#F4F4F5]! hover:text-ink!',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active marker — brand bar on the highlight's left edge */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-2.5 bottom-2.5 left-0 w-0.75 rounded-r-full bg-brand-500 transition-opacity duration-150 motion-reduce:transition-none',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className="relative flex shrink-0">
            <Icon
              size={18}
              strokeWidth={isActive ? 2 : 1.6}
              aria-hidden="true"
              className={cn(isActive ? 'text-brand-600' : 'text-muted group-hover:text-ink-2')}
            />
            {collapsed && item.badge != null && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 size-2 rounded-full bg-brand-500 ring-2 ring-white"
              />
            )}
            {collapsed && item.status && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-white"
              />
            )}
          </span>
          {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          {!collapsed && item.badge != null && (
            <span className="tnum inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10.5px] font-semibold text-white">
              {item.badge}
            </span>
          )}
          {!collapsed && item.status && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
              {item.status}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip
      title={item.status ? `${item.label} · ${item.status}` : item.badge != null ? `${item.label} (${item.badge})` : item.label}
      placement="right"
    >
      {link}
    </Tooltip>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
  onClose?: () => void;
  /** Desktop rail only — icon-only mode. */
  collapsed?: boolean;
}

export default function Sidebar({ onNavigate, onClose, collapsed = false }: SidebarProps) {
  const [role, setRole] = useState(ROLES[0]);
  const currentUser = useCurrentUser();
  const department = currentUser.department || '—';
  const inbox = useInboxStore((s) => s.count);
  const returned = useInboxStore((s) => s.returned);
  // Until the server has said, the administrators' rows stay hidden rather than flash and vanish
  const isAdmin = useIsAdmin() === true;
  // Menu rows whose number is live, not the made-up one of the prototype
  const liveBadges: Record<string, number | null> = { '/tasks': inbox, '/documents/returned': returned };

  return (
    <div className="bg-sidebar flex h-full flex-col border-r border-line text-ink">
      {/* Brand */}
      <div
        className={cn(
          'flex h-18 shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-2' : 'justify-between px-5',
        )}
      >
        {collapsed ? <LogoMark /> : <LogoLockup />}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-1.5 rounded-md p-1.5 text-muted transition-colors hover:bg-brand-50 hover:text-brand-600 lg:hidden"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main"
        className={cn('slim-scroll flex-1 overflow-x-hidden overflow-y-auto py-4', collapsed ? 'px-2.5' : 'px-3')}
      >
        {NAV.map((group, gi) => (
          <div key={group.title} className={cn(gi > 0 && 'mt-5')}>
            {collapsed ? (
              gi > 0 && <div aria-hidden="true" className="mx-auto mb-3 h-px w-6 bg-line" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">
                {group.title}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items
                .filter((item) => !item.admin || isAdmin)
                .map((item) => (
                <NavRow
                  key={item.to}
                  item={liveBadges[item.to] ? { ...item, badge: liveBadges[item.to] ?? undefined } : item}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Signed-in user */}
      <div className={cn('shrink-0 border-t border-line bg-surface', collapsed ? 'px-2.5 py-4' : 'p-3')}>
        {collapsed ? (
          <Tooltip title={`${currentUser.name} · ${role} · ${department}`} placement="right">
            <span
              tabIndex={0}
              aria-label={`${currentUser.name} · ${role} · ${department}`}
              className="mx-auto flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-[13px] font-semibold text-white shadow-card ring-1 ring-brand-800/10"
            >
              {currentUser.initials}
            </span>
          </Tooltip>
        ) : (
          <>
            <div className="rounded-2xl border border-brand-100/70 bg-linear-to-br from-brand-50/80 via-surface to-surface p-3 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-[13px] font-semibold text-white shadow-card ring-1 ring-brand-800/10">
                  {currentUser.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink" title={currentUser.name}>
                    {currentUser.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {[currentUser.employeeCode, currentUser.department].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </div>
              {/* <div className="mt-3 border-t border-brand-100/70 pt-2.5">
                <p className="mb-1.5 text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
                  Current role
                </p>
                <Select
                  aria-label="Switch role"
                  value={role}
                  onChange={setRole}
                  options={ROLES.map((r) => ({ value: r, label: r }))}
                  prefix={<ShieldCheck size={14} aria-hidden="true" className="mr-1 text-brand-500" />}
                  suffixIcon={<ChevronDown size={13} aria-hidden="true" className="text-muted" />}
                  className="w-full"
                  styles={{ root: { minHeight: 36, borderRadius: 8, fontSize: 11.5 } }}
                  popupMatchSelectWidth={240}
                  placement="topLeft"
                />
              </div> */}
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-muted">
              <Building2 size={11} strokeWidth={1.6} aria-hidden="true" className="shrink-0" />
              <p className="truncate text-[9px] font-medium tracking-[0.12em]">PROSPIRA THAILAND</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
