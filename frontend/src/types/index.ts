export interface User {
  id: string;
  email: string;
  businessName?: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

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
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

export interface RevenueStats {
  paid_count: string;
  total_revenue: string;
  overdue_count: string;
  overdue_amount: string;
  pending_count: string;
  pending_amount: string;
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
