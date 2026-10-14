/** Which side of the supplier a contact speaks for. Only quality contacts exist for now. */
export type SupplierContactType = 'QUALITY';

export interface SupplierContact {
  contact_id: number;
  contact_type: SupplierContactType;
  email: string;
  /** Optional: often only the address is known */
  name: string;
}

/** A vendor company and the people to write to there. */
export interface Supplier {
  supplier_id: number;
  code: string;
  name: string;
  is_active: boolean;
  contact_count: number;
  contacts: SupplierContact[];
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface SupplierInput {
  code: string;
  name: string;
  is_active: boolean;
  /** Kept in this order. They replace the supplier's existing contacts. */
  contacts: Array<{ email: string; name: string }>;
}
