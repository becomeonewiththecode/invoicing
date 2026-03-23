import jsPDF from 'jspdf';
import type { Invoice, InvoiceItem, UserSettings } from '../types';
import { formatInvoiceClientLabel } from './clientDisplay';

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function n(v: unknown): number {
  return typeof v === 'number' ? v : Number(v);
}

function fmtMoney(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function itemUnitPrice(item: InvoiceItem): number {
  const raw = item.unit_price ?? item.unitPrice;
  return n(raw);
}

/** Square-style invoice: clear hierarchy, neutral palette, strong “amount due”, professional line table. */
export async function generateInvoicePdf(invoice: Invoice, company?: UserSettings | null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 16;
  const right = pageW - M;
  const contentW = pageW - 2 * M;

  const gray = { label: [88, 88, 88] as [number, number, number], line: [200, 200, 200] as [number, number, number] };
  const ink: [number, number, number] = [33, 33, 33];
  const tableHeaderBg: [number, number, number] = [245, 245, 245];

  let y = M;

  // —— Top: logo (left) + INVOICE title (right) ——
  let logoBottom = y;
  if (company?.logoUrl) {
    const dataUrl = await loadImageDataUrl(company.logoUrl);
    if (dataUrl) {
      const fmt = /data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
      try {
        doc.addImage(dataUrl, fmt, M, y, 42, 18);
        logoBottom = y + 22;
      } catch {
        /* ignore */
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...ink);
  doc.text('INVOICE', right, y + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray.label);
  doc.text('Tax invoice', right, y + 18, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  y = Math.max(y + 22, logoBottom) + 4;

  // —— Company block (left) + Summary card (right) ——
  // Card top aligns with visual top of 13pt company title (baseline y → ~5mm ascender).
  const cardLeft = pageW * 0.52;
  const cardW = right - cardLeft;
  const cardPad = 3;
  /** Values start after longest label (~“Invoice number”) so the gap isn’t stretched to the far right */
  const labelColW = 28;
  /** jsPDF y is baseline; ~5mm matches cap height of 13pt title for top alignment */
  const cardTop = y - 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ink);
  doc.text(company?.businessName || 'Your business', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray.label);
  let leftY = y + 5;
  if (company?.businessAddress) {
    const lines = doc.splitTextToSize(company.businessAddress, cardLeft - M - 6);
    doc.text(lines, M, leftY);
    leftY += lines.length * 4;
  }
  doc.setTextColor(0, 0, 0);
  if (company?.businessPhone) {
    doc.text(company.businessPhone, M, leftY);
    leftY += 4;
  }
  if (company?.businessWebsite) {
    doc.setTextColor(40, 40, 40);
    doc.text(company.businessWebsite, M, leftY);
    leftY += 4;
    doc.setTextColor(0, 0, 0);
  }
  if (company?.businessFax) {
    doc.text(`Fax ${company.businessFax}`, M, leftY);
    leftY += 4;
  }
  if (company?.taxId) {
    doc.text(`Tax ID: ${company.taxId}`, M, leftY);
    leftY += 4;
  }

  // One line per row; tight vertical rhythm; values share a column (no full-width right align).
  const linePitch = 4.2;
  const cardPadBottom = 3;
  const cx = cardLeft + cardPad;
  const valueX = cx + labelColW;
  const cardH = cardPad + linePitch * 2 + 3 + cardPadBottom;

  doc.setDrawColor(...gray.line);
  doc.setLineWidth(0.3);
  doc.rect(cardLeft, cardTop, cardW, cardH, 'S');

  let cy = cardTop + cardPad;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray.label);
  doc.text('Invoice number', cx, cy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.invoice_number, valueX, cy);
  cy += linePitch;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray.label);
  doc.text('Date of issue', cx, cy);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(fmtDate(invoice.issue_date), valueX, cy);
  cy += linePitch;

  doc.setFontSize(8);
  doc.setTextColor(...gray.label);
  doc.text('Due date', cx, cy);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(fmtDate(invoice.due_date), valueX, cy);

  y = Math.max(leftY, cardTop + cardH) + 10;

  // —— Bill to ——
  doc.setFontSize(8);
  doc.setTextColor(...gray.label);
  doc.text('BILL TO', M, y);
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text(formatInvoiceClientLabel(invoice), M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const clientCompany = invoice.client_company?.trim();
  const clientContact = invoice.client_name?.trim();
  if (clientCompany && clientContact && clientCompany !== clientContact) {
    doc.text(`Contact: ${clientContact}`, M, y);
    y += 4;
  }
  if (invoice.client_email) {
    doc.text(invoice.client_email, M, y);
    y += 4;
  }
  if (invoice.client_address) {
    const addrLines = doc.splitTextToSize(invoice.client_address, contentW);
    doc.text(addrLines, M, y);
    y += addrLines.length * 4;
  }
  y += 6;

  // —— Amount due strip ——
  doc.setFillColor(250, 250, 250);
  doc.rect(M, y, contentW, 12, 'F');
  doc.setDrawColor(...gray.line);
  doc.line(M, y + 12, right, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text('Amount due', M + 3, y + 8);
  doc.setFontSize(14);
  doc.text(fmtMoney(n(invoice.total)), right - 3, y + 8, { align: 'right' });
  y += 18;

  // —— Line items table ——
  const colDesc = M;
  const colQty = 128;
  const colRate = 152;
  const colAmt = right;

  function drawTableHeader(yy: number) {
    doc.setFillColor(...tableHeaderBg);
    doc.rect(M, yy - 5, contentW, 8, 'F');
    doc.setDrawColor(...gray.line);
    doc.line(M, yy + 3, right, yy + 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...gray.label);
    doc.text('DESCRIPTION', colDesc + 1, yy);
    doc.text('QTY', colQty, yy, { align: 'right' });
    doc.text('RATE', colRate, yy, { align: 'right' });
    doc.text('AMOUNT', colAmt, yy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    return yy + 10;
  }

  y = drawTableHeader(y);

  const rowH = 6;
  const maxY = pageH - M - 40;

  if (invoice.items?.length) {
    for (const item of invoice.items) {
      if (y > maxY) {
        doc.addPage();
        y = M + 8;
        y = drawTableHeader(y);
      }
      const desc = doc.splitTextToSize(item.description, 105);
      const rows = Math.max(1, desc.length);
      const blockH = rows * 4 + 2;
      doc.setFontSize(9);
      doc.text(desc, colDesc + 1, y);
      doc.text(String(item.quantity), colQty, y, { align: 'right' });
      doc.text(fmtMoney(itemUnitPrice(item)), colRate, y, { align: 'right' });
      doc.text(fmtMoney(n(item.amount)), colAmt, y, { align: 'right' });
      y += Math.max(blockH, rowH);
    }
  }

  y += 4;
  doc.setDrawColor(...gray.line);
  doc.line(M, y, right, y);
  y += 8;

  // —— Totals (right column) ——
  const labelX = 138;
  doc.setFontSize(9);
  doc.text('Subtotal', labelX, y, { align: 'right' });
  doc.text(fmtMoney(n(invoice.subtotal)), colAmt, y, { align: 'right' });
  y += 6;

  if (n(invoice.discount_amount) > 0) {
    doc.setTextColor(...gray.label);
    doc.text(
      invoice.discount_code ? `Discount (${invoice.discount_code})` : 'Discount',
      labelX,
      y,
      { align: 'right' }
    );
    doc.setTextColor(0, 0, 0);
    doc.text(`−${fmtMoney(n(invoice.discount_amount))}`, colAmt, y, { align: 'right' });
    y += 6;
  }

  if (n(invoice.tax_amount) > 0) {
    doc.text(`Tax (${n(invoice.tax_rate)}%)`, labelX, y, { align: 'right' });
    doc.text(fmtMoney(n(invoice.tax_amount)), colAmt, y, { align: 'right' });
    y += 6;
  }

  doc.setDrawColor(...gray.line);
  doc.line(labelX - 42, y, right, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total', labelX, y, { align: 'right' });
  doc.text(fmtMoney(n(invoice.total)), colAmt, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 10;

  // —— Notes / terms ——
  if (invoice.notes?.trim()) {
    if (y > pageH - M - 35) {
      doc.addPage();
      y = M;
    }
    doc.setFontSize(8);
    doc.setTextColor(...gray.label);
    doc.text('NOTES', M, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const noteLines = doc.splitTextToSize(invoice.notes.trim(), contentW);
    doc.text(noteLines, M, y);
    y += noteLines.length * 4 + 4;
  }

  // —— Footer ——
  const footY = pageH - 12;
  doc.setFontSize(8);
  doc.setTextColor(...gray.label);
  doc.text('Thank you for your business.', M, footY);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, right, footY, { align: 'right' });

  return doc;
}
