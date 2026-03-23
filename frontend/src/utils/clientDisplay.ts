import type { Client } from '../types';

/** Company (or contact name if no company), with customer number — used wherever a client is referenced. */
export function formatClientLabel(c: {
  name: string;
  company?: string | null;
  customer_number?: string | null;
}): string {
  const org = (c.company?.trim() || c.name).trim();
  const num = c.customer_number?.trim();
  if (num) return `${org} (${num})`;
  return org;
}

/** Invoice API row (joined client fields). */
export function formatInvoiceClientLabel(invoice: {
  client_name?: string;
  client_company?: string | null;
  client_customer_number?: string | null;
}): string {
  const org = (invoice.client_company?.trim() || invoice.client_name || '').trim();
  const num = invoice.client_customer_number?.trim();
  if (num) return `${org} (${num})`;
  return org || '—';
}
