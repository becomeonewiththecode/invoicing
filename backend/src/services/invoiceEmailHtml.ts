function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function n(v: unknown): number {
  return typeof v === 'number' ? v : Number(v);
}

export type InvoiceEmailRow = {
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: unknown;
  tax_rate: unknown;
  tax_amount: unknown;
  discount_amount: unknown;
  discount_code?: string | null;
  total: unknown;
  notes?: string | null;
  client_name?: string;
  client_email?: string;
  /** From users.payable_text — invoice footer */
  payable_text?: string | null;
};

export type InvoiceItemEmailRow = {
  description: string;
  quantity: unknown;
  unit_price: unknown;
  amount: unknown;
};

export function buildInvoiceEmailText(inv: InvoiceEmailRow, items: InvoiceItemEmailRow[]): string {
  const lines: string[] = [
    `Invoice ${inv.invoice_number}`,
    `Status: ${inv.status}`,
    `Client: ${inv.client_name ?? '—'}`,
    `Issue: ${String(inv.issue_date).slice(0, 10)}  Due: ${String(inv.due_date).slice(0, 10)}`,
    '',
    'Line items:',
  ];
  for (const it of items) {
    lines.push(
      `  - ${it.description} | ${n(it.quantity)} × $${n(it.unit_price).toFixed(2)} = $${n(it.amount).toFixed(2)}`
    );
  }
  lines.push('', `Subtotal: $${n(inv.subtotal).toFixed(2)}`);
  if (n(inv.discount_amount) > 0) {
    lines.push(`Discount: $${n(inv.discount_amount).toFixed(2)}`);
  }
  if (n(inv.tax_amount) > 0) {
    lines.push(`Tax (${n(inv.tax_rate)}%): $${n(inv.tax_amount).toFixed(2)}`);
  }
  lines.push(`Total: $${n(inv.total).toFixed(2)}`);
  if (inv.notes?.trim()) {
    lines.push('', `Notes: ${inv.notes.trim()}`);
  }
  if (inv.payable_text?.trim()) {
    lines.push('', `Pay to: ${inv.payable_text.trim()}`);
  }
  return lines.join('\n');
}

export function buildInvoiceEmailHtml(inv: InvoiceEmailRow, items: InvoiceItemEmailRow[]): string {
  const rows = items
    .map(
      (it) => `<tr>
  <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(it.description)}</td>
  <td style="padding:8px;border:1px solid #ddd;text-align:right;">${n(it.quantity).toFixed(2)}</td>
  <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${n(it.unit_price).toFixed(2)}</td>
  <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${n(it.amount).toFixed(2)}</td>
</tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;font-size:14px;color:#111;">
  <h1 style="font-size:18px;margin:0 0 12px;">Invoice ${escapeHtml(inv.invoice_number)}</h1>
  <p style="margin:4px 0;"><strong>Status:</strong> ${escapeHtml(inv.status)}</p>
  <p style="margin:4px 0;"><strong>Client:</strong> ${escapeHtml(inv.client_name ?? '—')}</p>
  ${inv.client_email ? `<p style="margin:4px 0;"><strong>Client email:</strong> ${escapeHtml(inv.client_email)}</p>` : ''}
  <p style="margin:4px 0;"><strong>Issue date:</strong> ${escapeHtml(String(inv.issue_date).slice(0, 10))}</p>
  <p style="margin:4px 0 16px;"><strong>Due date:</strong> ${escapeHtml(String(inv.due_date).slice(0, 10))}</p>
  <table style="border-collapse:collapse;width:100%;max-width:640px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Description</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:right;">Qty</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:right;">Rate</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table style="margin-top:12px;max-width:320px;">
    <tr><td style="padding:4px 8px 4px 0;color:#666;">Subtotal</td><td style="padding:4px 0;text-align:right;">$${n(inv.subtotal).toFixed(2)}</td></tr>
    ${
      n(inv.discount_amount) > 0
        ? `<tr><td style="padding:4px 8px 4px 0;color:#666;">Discount${inv.discount_code ? ` (${escapeHtml(inv.discount_code)})` : ''}</td><td style="padding:4px 0;text-align:right;">−$${n(inv.discount_amount).toFixed(2)}</td></tr>`
        : ''
    }
    ${
      n(inv.tax_amount) > 0
        ? `<tr><td style="padding:4px 8px 4px 0;color:#666;">Tax (${n(inv.tax_rate)}%)</td><td style="padding:4px 0;text-align:right;">$${n(inv.tax_amount).toFixed(2)}</td></tr>`
        : ''
    }
    <tr><td style="padding:8px 8px 4px 0;font-weight:bold;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;">$${n(inv.total).toFixed(2)}</td></tr>
  </table>
  ${inv.notes?.trim() ? `<p style="margin-top:16px;"><strong>Notes</strong><br>${escapeHtml(inv.notes.trim()).replace(/\n/g, '<br>')}</p>` : ''}
  ${
    inv.payable_text?.trim()
      ? `<p style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e5e5;color:#333;"><strong>Pay to</strong><br>${escapeHtml(inv.payable_text.trim()).replace(/\n/g, '<br>')}</p>`
      : ''
  }
</body></html>`;
}
