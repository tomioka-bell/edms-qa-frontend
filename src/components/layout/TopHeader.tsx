import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Modal } from 'antd';
import { ChevronRight, Menu, Search, LogOut, UserRound, Settings, FileText, CornerDownLeft, Signature } from 'lucide-react';
import NotificationMenu from './NotificationMenu';
import ActAsSwitcher from '../dev/ActAsSwitcher';
import ProfileDrawer from '../profile/ProfileDrawer';
import { useCurrentUser } from '../../stores/session';
import { mockDocuments } from '../../data/mockDocuments';
import { cn } from '../../lib/cn';
import { logout } from '../../lib/auth';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks': 'My Tasks',
  '/my-documents': 'My Documents',
  '/documents': 'Document Library',
  '/documents/new': 'Create Document',
  '/documents/returned': 'Returned Documents',
  '/documents/released': 'Released Documents',
  '/documents/expiring': 'Expiring Documents',
  '/documents/obsolete': 'Obsolete Documents',
  '/control/approval': 'Documents for Approval',
  '/control/review': 'Documents for Review',
  '/control/acknowledgement': 'Document Acknowledgement',
  '/search': 'Search',
  '/reports': 'Reports',
  '/audit-trail': 'Audit Trail',
  '/document-templates': 'Document Templates',
  '/my-signature': 'My Signature',
  '/approval-templates': 'Approval Templates',
  '/suppliers': 'Suppliers',
  '/access': 'Access',
  '/edi': 'EDI',
  '/master-data': 'Master Data',
  '/settings': 'Settings',
};

interface Props {
  /** Opens the drawer below lg. */
  onOpenNav: () => void;
  /** Collapses the desktop rail at lg and up. */
  onToggleCollapse: () => void;
  collapsed: boolean;
}

export default function TopHeader({ onOpenNav, onToggleCollapse, collapsed }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [q, setQ] = useState('');

  // An address with no title is not one of the app's pages: the 404 screen is showing
  const pageTitle =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith('/documents/edit/') ? 'Edit Document' : pathname.startsWith('/tasks/') ? 'Review Document' : 'Page not found');

  // ⌘K / Ctrl-K opens quick search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = q.trim()
    ? mockDocuments
        .filter(
          (d) =>
            d.code.toLowerCase().includes(q.toLowerCase()) ||
            d.name.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, 6)
    : mockDocuments.slice(0, 5);

  const iconBtn =
    'flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-[#F4F4F5] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400';

  return (
    <>
      <header className="sticky top-0 z-30 flex h-(--header-h) shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:gap-4 sm:px-6">
        {/* Mobile: open drawer · Desktop: collapse rail */}
        <button type="button" onClick={onOpenNav} aria-label="Open navigation" className={cn(iconBtn, '-ml-2 lg:hidden')}>
          <Menu size={20} />
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(iconBtn, '-ml-2 hidden lg:flex')}
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 shrink-0 items-center gap-1.5 text-[14px]">
          <Link to="/dashboard" className="hidden shrink-0 text-muted! transition-colors hover:text-ink! sm:block">
            PSTH EDMS
          </Link>
          <ChevronRight size={14} aria-hidden="true" className="hidden shrink-0 text-faint sm:block" />
          <span aria-current="page" className="truncate font-semibold text-ink">
            {pageTitle}
          </span>
        </nav>

        {/* Search — a wide field from md; an icon button below */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden h-10 max-w-150 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-[#FAFAFB] px-3.5 text-left transition-colors hover:border-[#D4D4D8] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 md:flex"
        >
          <Search size={17} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="flex-1 truncate text-[14px] text-muted">
            Search document number, title, keyword, machine, product, project…
          </span>
          <kbd className="hidden rounded border border-line bg-surface px-1.5 py-px font-sans text-[10.5px] font-medium text-muted xl:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className={cn(iconBtn, 'md:hidden')}
          >
            <Search size={19} />
          </button>

          <ActAsSwitcher />

          <NotificationMenu />

          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            open={accountOpen}
            onOpenChange={setAccountOpen}
            styles={{ item: { borderRadius: 8, minHeight: 38, fontSize: 13 } }}
            popupRender={(menu) => (
              <div className="w-64 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
                <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[13px] font-semibold text-white">
                    {currentUser.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{currentUser.name}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted" title={currentUser.email}>
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                {menu}
              </div>
            )}
            menu={{
              style: { padding: 6, borderRadius: 0, boxShadow: 'none', background: 'transparent' },
              items: [
                { key: 'profile', icon: <UserRound size={16} className="text-muted" />, label: 'View profile' },
                { key: 'signature', icon: <Signature size={16} className="text-muted" />, label: 'My signature' },
                { key: 'prefs', icon: <Settings size={16} className="text-muted" />, label: 'Preferences' },
                { type: 'divider' },
                { key: 'logout', icon: <LogOut size={16} />, label: 'Sign out', danger: true },
              ],
              onClick: ({ key }) => {
                setAccountOpen(false);
                if (key === 'profile') setProfileOpen(true);
                if (key === 'signature') navigate('/my-signature');
                if (key === 'logout') void logout();
              },
            }}
          >
            <button
              type="button"
              aria-label={`Account menu for ${currentUser.name}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[13px] font-semibold text-white transition-shadow hover:shadow-[0_0_0_4px_rgb(31_74_143/0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              {currentUser.initials}
            </button>
          </Dropdown>
        </div>
      </header>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Quick search */}
      <Modal
        open={paletteOpen}
        onCancel={() => {
          setPaletteOpen(false);
          setQ('');
        }}
        footer={null}
        closable={false}
        width={560}
        styles={{ body: { padding: 0 } }}
        classNames={{ container: '!p-0 overflow-hidden' }}
        destroyOnHidden
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={17} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search document number, title, keyword…"
            className="h-13! flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line bg-[#FAFAFB] px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-muted">
            ESC
          </kbd>
        </div>

        <div className="slim-scroll max-h-85 overflow-y-auto p-2">
          <p className="px-2.5 pt-1.5 pb-2 text-[10.5px] font-semibold tracking-widest text-faint uppercase">
            {q.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Recent documents'}
          </p>
          {results.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-[13px] text-muted">
              No documents match “{q}”.
            </p>
          ) : (
            results.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setPaletteOpen(false);
                  setQ('');
                  navigate('/documents', { state: { focusDoc: d.id } });
                }}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-[#FAFAFB]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-faint">
                  <FileText size={15} strokeWidth={1.85} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="doc-code block text-brand-600">{d.code}</span>
                  <span className="block truncate text-[13px] text-ink-2">{d.name}</span>
                </span>
                <CornerDownLeft
                  size={14}
                  className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
