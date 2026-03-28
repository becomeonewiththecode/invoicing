import axios from 'axios';
import api from './client';
import type { Invoice, PaginatedResponse, RevenueStats, ClientInvoiceStats } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export async function getInvoices(
  page = 1,
  limit = 20,
  clientId?: string
): Promise<PaginatedResponse<Invoice>> {
  const { data } = await api.get('/invoices', {
    params: { page, limit, ...(clientId ? { clientId } : {}) },
  });
  return data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get(`/invoices/${id}`);
  return data;
}

/** Non-cancelled invoices already using this project (excludes `excludeInvoiceId` when editing). */
export type InvoiceProjectConflict = { id: string; invoice_number: string; status: string };

export async function getInvoicesLinkedToProject(
  projectId: string,
  options?: { excludeInvoiceId?: string }
): Promise<InvoiceProjectConflict[]> {
  const { data } = await api.get<{ data: InvoiceProjectConflict[] }>(`/invoices/for-project/${projectId}`, {
    params: options?.excludeInvoiceId ? { excludeInvoiceId: options.excludeInvoiceId } : {},
  });
  return data.data;
}

export type InvoicePayload = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  taxRate?: number;
  discountCode?: string;
  notes?: string;
  /** Optional project for this client (must belong to the client) */
  projectId?: string | null;
  isRecurring?: boolean;
  recurrenceInterval?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
};

export async function createInvoice(invoice: InvoicePayload): Promise<Invoice> {
  const { data } = await api.post('/invoices', invoice);
  return data;
}

export async function updateInvoice(id: string, invoice: InvoicePayload): Promise<Invoice> {
  const { data } = await api.put(`/invoices/${id}`, invoice);
  return data;
}

export async function updateInvoiceStatus(id: string, status: string): Promise<Invoice> {
  const { data } = await api.patch(`/invoices/${id}/status`, { status });
  return data;
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`);
}

export async function sendInvoiceToCompanyEmail(id: string): Promise<{ ok: boolean; sentTo: string }> {
  const { data } = await api.post<{ ok: boolean; sentTo: string }>(`/invoices/${id}/send-to-company`);
  return data;
}

export async function createShareLink(id: string): Promise<{ token: string }> {
  const { data } = await api.post<{ token: string }>(`/invoices/${id}/share`);
  return data;
}

export async function revokeShareLink(id: string): Promise<void> {
  await api.delete(`/invoices/${id}/share`);
}

/** Fetches a shared invoice — public, no auth required. */
export async function getSharedInvoice(token: string): Promise<Invoice> {
  const { data } = await axios.get(`${API_BASE}/invoices/share/${token}`);
  return data;
}

/** Marks a shared invoice as paid — public, no auth required. */
export async function markSharedInvoicePaid(token: string): Promise<{ invoice_number: string; status: string }> {
  const { data } = await axios.patch(`${API_BASE}/invoices/share/${token}/status`, { status: 'paid' });
  return data;
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const { data } = await api.get('/invoices/stats/revenue');
  return data;
}

export async function getClientInvoiceStats(clientId: string): Promise<ClientInvoiceStats> {
  const { data } = await api.get<ClientInvoiceStats>(`/invoices/stats/by-client/${clientId}`);
  return data;
}

export async function exportInvoicesCsv(): Promise<Blob> {
  const { data } = await api.get('/invoices/export/csv', { responseType: 'blob' });
  return data;
}
