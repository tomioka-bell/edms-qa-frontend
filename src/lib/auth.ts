// โหมด login ของ QA — QA ไม่มีหน้า login ของตัวเอง ใช้ login กลางเสมอ
//   local   = รันเดี่ยวตอน npm run dev: login ที่ portal (VITE_PORTAL_URL) แล้ว cookie ใช้ร่วมกันบน localhost
//   gateway = ใช้ session จาก auth-web (cookie ของ /api/auth) — production ใช้โหมดนี้เสมอ
export const USE_GATEWAY_AUTH = import.meta.env.PROD || import.meta.env.VITE_AUTH_MODE === 'gateway';

export interface Me {
  user_id: number;
  username: string;
  employee_code: string;
  display_name: string;
  email: string;
  department_code: string;
  is_super_admin?: boolean;
}

export class AuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const AUTH_API = '/api/auth/v1';

// A refresh token works once: using it gives a new one, and a second request carrying the old one
// is refused. A page fires several requests together, so when the access token runs out they all
// get a 401 at the same moment. They must share one refresh instead of each sending their own.
let refreshing: Promise<boolean> | null = null;

/**
 * ต่ออายุ session ด้วย refresh token — ทุกคำขอที่เจอ 401 พร้อมกันรอ refresh ครั้งเดียวกัน
 * คืน true เมื่อใช้ session ต่อได้ (รวมกรณีอีก tab เพิ่ง refresh ไปแล้ว: 409 REFRESH_CONCURRENT)
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${AUTH_API}/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (res.ok) return true;
      if (res.status !== 409) return false;
      // Another tab refreshed a moment ago and its new cookies are arriving; give them time to land
      await new Promise((resolve) => setTimeout(resolve, 300));
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** ข้อมูลผู้ใช้ที่ login อยู่ — access token หมดอายุจะ refresh ให้ 1 ครั้งก่อนยอมแพ้ */
export async function getMe(): Promise<Me> {
  let res = await fetch(`${AUTH_API}/me`, { credentials: 'include' });
  if (res.status === 401 && (await refreshSession())) {
    res = await fetch(`${AUTH_API}/me`, { credentials: 'include' });
  }
  if (!res.ok) throw new AuthError(res.status, `HTTP_${res.status}`);
  return res.json() as Promise<Me>;
}

/** ไปหน้า login ของ auth-web แล้วให้กลับมาหน้าปัจจุบันหลัง login */
export function goToLogin(returnTo = window.location.pathname + window.location.search) {
  window.location.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
}

// หน้า login ของ portal — ใช้ตอนรันเดี่ยว (โหมด local) ที่ไม่มี auth-web อยู่หน้า QA
export const PORTAL_URL: string = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5175';

/** session หมดอายุ: ล้าง cookie ที่ค้างอยู่ แล้วพาไปหน้า login */
export async function leaveToLogin() {
  try {
    await fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    /* ต่อ backend ไม่ได้ก็ยังต้องพาออกไปหน้า login */
  }
  if (USE_GATEWAY_AUTH) goToLogin();
  else window.location.replace(`${PORTAL_URL}/login`);
}

export async function logout() {
  try {
    await fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' });
  } finally {
    window.location.replace(USE_GATEWAY_AUTH ? '/login' : `${PORTAL_URL}/login`);
  }
}
