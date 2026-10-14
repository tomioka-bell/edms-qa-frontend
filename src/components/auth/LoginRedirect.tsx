import { useEffect } from 'react';
import { goToLogin, PORTAL_URL, USE_GATEWAY_AUTH } from '../../lib/auth';

/** QA ไม่มีหน้า login ของตัวเอง — /qa/login เดิมให้ส่งต่อไปหน้า login กลาง */
export default function LoginRedirect() {
  useEffect(() => {
    if (USE_GATEWAY_AUTH) goToLogin('/qa/dashboard');
    else window.location.replace(`${PORTAL_URL}/login`);
  }, []);
  return null;
}
