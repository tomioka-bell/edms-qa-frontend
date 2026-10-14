import { api } from './api';

/** How a signature image was made. */
export type SignatureSource = 'DRAWN' | 'UPLOADED';

/** The signed-in person's signature, as the backend describes it. */
export interface MySignature {
  signature_id: number;
  source: SignatureSource;
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
  /** Where to load the image from; changes with every new signature */
  image_url: string;
}

const BASE = '/api/signature/me';

/** Limit enforced by the backend; mirrored here so the page can say so before sending. */
export const MAX_SIGNATURE_BYTES = 1024 * 1024;

/** The caller's current signature, or null when they have not set one. */
export async function getMySignature(): Promise<MySignature | null> {
  const res = await api<{ data: MySignature | null }>(BASE);
  return res.data;
}

/** Sets the caller's signature from a PNG image. A signature they already had is kept on file as replaced. */
export async function saveMySignature(image: Blob, source: SignatureSource): Promise<MySignature> {
  const body = new FormData();
  body.append('file', image, 'signature.png');
  body.append('source', source);
  const res = await api<{ data: MySignature }>(BASE, { method: 'PUT', body });
  return res.data;
}

/** Removes the caller's signature. Approvals already signed with it are not affected. */
export async function removeMySignature(): Promise<void> {
  await api(BASE, { method: 'DELETE' });
}
