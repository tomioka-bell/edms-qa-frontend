import { useEffect } from 'react';
import { Spin } from 'antd';
import { leaveToLogin } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';

/**
 * Loads the signed-in user when the app opens, and signs the user out and sends them to the
 * sign-in page as soon as the session is found to have ended.
 */
export default function SessionWatcher() {
  const expired = useSessionStore((s) => s.expired);
  const loadUser = useSessionStore((s) => s.loadUser);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (expired) void leaveToLogin();
  }, [expired]);

  if (!expired) return null;
  // Covers the page while the browser leaves, so nothing can be clicked against a dead session
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-canvas" role="alert" aria-live="assertive">
      <div className="flex flex-col items-center gap-3 text-center">
        <Spin size="large" />
        <p className="text-[14px] font-semibold text-ink">Your session has ended</p>
        <p className="text-[12.5px] text-muted">Taking you to the sign-in page…</p>
      </div>
    </div>
  );
}
