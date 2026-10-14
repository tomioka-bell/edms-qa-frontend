import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Drawer } from 'antd';
import Sidebar from '../components/layout/Sidebar';
import TopHeader from '../components/layout/TopHeader';
import SessionWatcher from '../components/auth/SessionWatcher';
import { cn } from '../lib/cn';

const COLLAPSED_KEY = 'qa.sidebar.collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () =>
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable — keep in-memory state only */
      }
      return next;
    });

  return (
    <div className="flex min-h-screen bg-canvas">
      <SessionWatcher />
      {/* Desktop rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block',
          collapsed ? 'w-(--sidebar-w-collapsed)' : 'w-(--sidebar-w)',
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile / tablet navigation */}
      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        placement="left"
        size={272}
        closable={false}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        rootClassName="lg:hidden"
      >
        <Sidebar onNavigate={() => setNavOpen(false)} onClose={() => setNavOpen(false)} />
      </Drawer>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none',
          collapsed ? 'lg:pl-(--sidebar-w-collapsed)' : 'lg:pl-(--sidebar-w)',
        )}
      >
        <TopHeader onOpenNav={() => setNavOpen(true)} onToggleCollapse={toggleCollapsed} collapsed={collapsed} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
