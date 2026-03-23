import type { Client, DiscountCode, Invoice, InvoiceItem } from '../types';

export function computeDiscountAmount(
  subtotal: number,
  code: string | null | undefined,
  discounts: DiscountCode[]
): number {
  const trimmed = code?.trim();
  if (!trimmed) return 0;
  const dc = discounts.find((d) => d.is_active && d.code === trimmed);
  if (!dc) return 0;
  if (dc.type === 'percent') {
    return (subtotal * Number(dc.value)) / 100;
  }
  return Math.min(Number(dc.value), subtotal);
}

export interface InvoiceFormShape {
  clientId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  isRecurring: boolean;
  recurrenceInterval?: string;
  items: { description: string; hours: number }[];
}

/** Builds a synthetic Invoice for PDF/HTML preview (not persisted). */
export function buildInvoiceFromForm(
  form: InvoiceFormShape,
  settings: { defaultTaxRate: number; defaultHourlyRate: number | null } | null,
  client: Client | undefined,
  discounts: DiscountCode[],
  existing: Invoice | null
): Invoice | null {
  if (!form.clientId) return null;
  const hourly = settings?.defaultHourlyRate ?? 0;
  const taxRate = settings?.defaultTaxRate ?? 0;

  const lineItems: InvoiceItem[] = form.items
    .filter((i) => i.description?.trim() && Number(i.hours) > 0)
    .map((i) => {
      const qty = Number(i.hours);
      const unit = hourly;
      const amount = qty * unit;
      return {
        description: i.description.trim(),
        quantity: qty,
        unitPrice: unit,
        unit_price: unit,
        amount,
      };
    });

  if (lineItems.length === 0) return null;

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const discountCode = client?.discount_code?.trim() || null;
  const discountAmount = computeDiscountAmount(subtotal, discountCode, discounts);
  const taxable = subtotal - discountAmount;
  const taxAmount = (taxable * taxRate) / 100;
  const total = taxable + taxAmount;

  return {
    id: existing?.id ?? '00000000-0000-0000-0000-000000000001',
    user_id: existing?.user_id ?? '',
    client_id: form.clientId,
    invoice_number: existing?.invoice_number ?? 'PREVIEW',
    status: 'draft',
    issue_date: form.issueDate,
    due_date: form.dueDate,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_code: discountCode ?? undefined,
    discount_amount: discountAmount,
    total,
    notes: form.notes?.trim() || undefined,
    is_recurring: form.isRecurring,
    recurrence_interval: form.isRecurring ? form.recurrenceInterval : undefined,
    client_name: client?.name,
    client_email: client?.email,
    client_company: client?.company,
    client_address: client?.address,
    client_customer_number: client?.customer_number,
    items: lineItems,
    created_at: existing?.created_at ?? '',
    updated_at: existing?.updated_at ?? '',
  };
}
