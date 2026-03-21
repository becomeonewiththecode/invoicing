import jsPDF from 'jspdf';
import type { Invoice } from '../types';

export function generateInvoicePdf(invoice: Invoice, businessName?: string) {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFontSize(24);
  doc.text(businessName || 'Invoice', margin, y);
  y += 15;

  // Invoice details
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoice.invoice_number}`, margin, y);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 140, y);
  y += 7;
  doc.text(`Issue Date: ${invoice.issue_date}`, margin, y);
  doc.text(`Due Date: ${invoice.due_date}`, 140, y);
  y += 12;

  // Client info
  doc.setFontSize(12);
  doc.text('Bill To:', margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(invoice.client_name || '', margin, y);
  y += 5;
  if (invoice.client_company) {
    doc.text(invoice.client_company, margin, y);
    y += 5;
  }
  if (invoice.client_email) {
    doc.text(invoice.client_email, margin, y);
    y += 5;
  }
  if (invoice.client_address) {
    doc.text(invoice.client_address, margin, y);
    y += 5;
  }
  y += 10;

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, 170, 8, 'F');
  doc.setFontSize(9);
  doc.text('Description', margin + 2, y);
  doc.text('Qty', 110, y, { align: 'right' });
  doc.text('Unit Price', 140, y, { align: 'right' });
  doc.text('Amount', 188, y, { align: 'right' });
  y += 8;

  // Items
  if (invoice.items) {
    for (const item of invoice.items) {
      doc.text(item.description, margin + 2, y);
      doc.text(item.quantity.toString(), 110, y, { align: 'right' });
      doc.text(`$${(item.unit_price ?? item.unitPrice).toFixed(2)}`, 140, y, { align: 'right' });
      doc.text(`$${item.amount.toFixed(2)}`, 188, y, { align: 'right' });
      y += 6;
    }
  }

  y += 5;
  doc.line(margin, y, 190, y);
  y += 8;

  // Totals
  doc.text('Subtotal:', 140, y, { align: 'right' });
  doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, 188, y, { align: 'right' });
  y += 6;

  if (Number(invoice.discount_amount) > 0) {
    doc.text('Discount:', 140, y, { align: 'right' });
    doc.text(`-$${Number(invoice.discount_amount).toFixed(2)}`, 188, y, { align: 'right' });
    y += 6;
  }

  if (Number(invoice.tax_amount) > 0) {
    doc.text(`Tax (${invoice.tax_rate}%):`, 140, y, { align: 'right' });
    doc.text(`$${Number(invoice.tax_amount).toFixed(2)}`, 188, y, { align: 'right' });
    y += 6;
  }

  doc.setFontSize(12);
  doc.text('Total:', 140, y, { align: 'right' });
  doc.text(`$${Number(invoice.total).toFixed(2)}`, 188, y, { align: 'right' });

  // Notes
  if (invoice.notes) {
    y += 15;
    doc.setFontSize(10);
    doc.text('Notes:', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(invoice.notes, margin, y, { maxWidth: 170 });
  }

  return doc;
}
