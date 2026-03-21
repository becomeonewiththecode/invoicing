import api from './client';
import type { Invoice, PaginatedResponse, RevenueStats } from '../types';

export async function getInvoices(page = 1, limit = 20): Promise<PaginatedResponse<Invoice>> {
  const { data } = await api.get('/invoices', { params: { page, limit } });
  return data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get(`/invoices/${id}`);
  return data;
}

export async function createInvoice(invoice: {
  clientId: string;
  issueDate: string;
  dueDate: string;
  taxRate?: number;
  discountCode?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceInterval?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}): Promise<Invoice> {
  const { data } = await api.post('/invoices', invoice);
  return data;
}

export async function updateInvoiceStatus(id: string, status: string): Promise<Invoice> {
  const { data } = await api.patch(`/invoices/${id}/status`, { status });
  return data;
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`);
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const { data } = await api.get('/invoices/stats/revenue');
  return data;
}

export async function exportInvoicesCsv(): Promise<Blob> {
  const { data } = await api.get('/invoices/export/csv', { responseType: 'blob' });
  return data;
}
