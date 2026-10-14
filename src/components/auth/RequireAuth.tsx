import { useEffect, useState, type ReactNode } from 'react';
import { Button, Result, Spin } from 'antd';
import { AuthError, getMe, goToLogin } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';

type State = 'checking' | 'ok' | 'error';

/** กันหน้าใน QA: ไม่มี session → ส่งไป login ของ auth-web */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [errorCode, setErrorCode] = useState('');

  const check = () =>
    getMe()
      .then((me) => {
        useSessionStore.getState().setUser(me);
        setState('ok');
      })
      .catch((err) => {
        if (err instanceof AuthError && err.status === 401) return goToLogin();
        // 404 = ไม่ได้เปิดผ่าน gateway, 502/504 = gateway ต่อ auth backend ไม่ได้, NETWORK = gateway ไม่ได้รัน
        setErrorCode(err instanceof AuthError ? `HTTP ${err.status}` : 'NETWORK');
        setState('error');
      });

  const retry = () => {
    setState('checking');
    void check();
  };

  useEffect(() => void check(), []);

  if (state === 'ok') return children;
  if (state === 'error') {
    return (
      <Result
        status="warning"
        title="Cannot reach the sign-in service"
        subTitle={`Please check your connection and try again. (${errorCode})`}
        extra={<Button type="primary" onClick={retry}>Try again</Button>}
      />
    );
  }
  return (
    <div className="grid min-h-screen place-items-center">
      <Spin size="large" />
    </div>
  );
}
