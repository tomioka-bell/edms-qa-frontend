import { refreshSession } from './auth';
import { useSessionStore } from '../stores/session';

/** Error from the backend, with the HTTP status so screens can tell "sign in again" from "try again". */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The backend answers errors in two shapes:
//   {"error":{"code","message"}}         auth / session
//   {"success":false,"error":"message"}  everything else
function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  }
  return `Request failed (HTTP ${status})`;
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      credentials: 'include',
      // JSON bodies are sent as strings; a FormData upload must keep the browser's own multipart header
      headers: typeof init?.body === 'string' ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
}

/**
 * Sends a request with the session cookie. An expired access token is refreshed (one refresh
 * shared by all the requests waiting on it) and the request repeated; if that fails too the
 * session is marked expired and the user is signed out. Errors are thrown as ApiError.
 */
async function request(path: string, init?: RequestInit): Promise<Response> {
  let res = await send(path, init);
  if (res.status === 401) {
    // Shared with every other request that got a 401 at the same moment: the refresh token works only once
    if (await refreshSession()) res = await send(path, init);
    // Still refused: the session is over. Flag it so the app signs the user out.
    if (res.status === 401) useSessionStore.getState().expire();
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(body, res.status));
  }
  return res;
}

/** Calls the backend and returns its JSON answer. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  return (await res.json().catch(() => null)) as T;
}

/** Calls the backend for a file (a PDF, an image) and returns its bytes. */
export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await request(path, init);
  return res.blob();
}
