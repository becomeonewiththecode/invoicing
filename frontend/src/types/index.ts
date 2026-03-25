export interface User {
  id: string;
  email: string;
  businessName?: string;
  role?: string;
}

/** Company profile & defaults from GET/PUT /api/settings */
export interface UserSettings {
  businessName: string | null;
  defaultTaxRate: number;
  businessPhone: string | null;
  businessWebsite: string | null;
  businessAddress: string | null;
  taxId: string | null;
  defaultHourlyRate: number | null;
  businessFax: string | null;
  /** Optional; invoice copies use this, otherwise the account login email */
  businessEmail: string | null;
  logoUrl: string | null;
  /** Footer text on invoices (PDF, shared link, email) */
  payableText: string | null;
}

export interface Client {
  id: string;
  user_id: string;
  /** Set after DB migration 003; may be absent on unmigrated DBs */
  customer_number?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  /** Default discount for invoices; must match an active discount code */
  discount_code?: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'late' | 'cancelled';

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit_price?: number;
  amount: number;
  sort_order?: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_code?: string;
  discount_amount: number;
  total: number;
  notes?: string;
  is_recurring: boolean;
  recurrence_interval?: string;
  client_name?: string;
  client_email?: string;
  client_company?: string;
  client_address?: string;
  client_customer_number?: string;
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
  /** Set when invoice is marked sent; late status after 30 days from this time */
  sent_at?: string | null;
  /** Non-null when a shareable public link has been generated */
  share_token?: string | null;
  /** From company settings; included on shared invoice view */
  payable_text?: string | null;
}

export interface RevenueStats {
  paid_count: string;
  total_revenue: string;
  late_count: string;
  late_amount: string;
  pending_count: string;
  pending_amount: string;
}

/** GET /invoices/stats/by-client/:clientId — per-client counts and totals by status */
export interface ClientInvoiceStats {
  draft_count: string;
  sent_count: string;
  paid_count: string;
  late_count: string;
  draft_total: string;
  sent_total: string;
  paid_total: string;
  late_total: string;
  total_revenue: string;
  total_tax: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  description?: string;
  type: 'percent' | 'fixed';
  value: number;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
