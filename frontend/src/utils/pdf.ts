import jsPDF from 'jspdf';
import type { Invoice, InvoiceItem, UserSettings } from '../types';
import { formatInvoiceClientLabel } from './clientDisplay';
import { resolveApiAssetUrl } from './resolveApiUrl';

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const resolved = resolveApiAssetUrl(url);
    const res = await fetch(resolved, { mode: 'cors' });
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

/** Square-style invoice: clear hierarchy, neutral palette, professional line table. */
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

  // —— Top: INVOICE title (left) + optional logo (right) ——
  let logoBottom = y;
  if (company?.logoUrl) {
    const dataUrl = await loadImageDataUrl(company.logoUrl);
    if (dataUrl) {
      const fmt = /data:image\/jpe?g/i.test(dataUrl)
        ? 'JPEG'
        : /data:image\/webp/i.test(dataUrl)
          ? 'WEBP'
          : 'PNG';
      try {
        doc.addImage(dataUrl, fmt, right - 42, y, 42, 18);
        logoBottom = y + 22;
      } catch {
        /* ignore */
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...ink);
  doc.text('INVOICE', M, y + 12);
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

  // —— Line items table (grid: desc | qty | rate | amount) ——
  const colDesc = M;
  /** Column boundaries (mm). Hours column sized for typical values; rate/amount stay readable. */
  const vDescQty = 126;
  const vQtyRate = 146;
  const vRateAmt = 168;
  const colQtyRight = vQtyRate;
  const colRateRight = vRateAmt;
  const colAmt = right;
  const descTextW = vDescQty - M - 2;
  /** Inset (mm) so right-aligned figures sit off the vertical grid lines. */
  const colPad = 1.5;
  const qtyX = colQtyRight - colPad;
  const rateX = colRateRight - colPad;
  const amtX = colAmt - colPad;

  function drawTableHeader(yy: number) {
    doc.setDrawColor(...gray.line);
    doc.line(M, yy - 5, right, yy - 5);
    doc.setFillColor(...tableHeaderBg);
    doc.rect(M, yy - 5, contentW, 9, 'F');
    doc.setDrawColor(...gray.line);
    doc.line(M, yy + 4, right, yy + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...gray.label);
    doc.text('DESCRIPTION', colDesc + 1, yy);
    doc.text('Hours', qtyX, yy, { align: 'right' });
    doc.text('RATE', rateX, yy, { align: 'right' });
    doc.text('AMOUNT', amtX, yy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    return yy + 10;
  }

  function strokeVerticalGrid(topY: number, bottomY: number) {
    doc.setDrawColor(...gray.line);
    doc.line(M, topY, M, bottomY);
    doc.line(vDescQty, topY, vDescQty, bottomY);
    doc.line(vQtyRate, topY, vQtyRate, bottomY);
    doc.line(vRateAmt, topY, vRateAmt, bottomY);
    doc.line(right, topY, right, bottomY);
  }

  let tableSegmentStartY = y;
  y = drawTableHeader(y);
  let tableTopY = tableSegmentStartY - 5;

  /** Min row height (mm); line items need enough room so text baseline isn’t on the row rule */
  const rowH = 7;
  /** Gap (mm) below each horizontal rule before the next row’s baseline — avoids overlap with the line */
  const rowGapAfterRule = 2;
  const maxY = pageH - M - 40;

  if (invoice.items?.length) {
    for (const item of invoice.items) {
      const descRaw = doc.splitTextToSize(item.description, descTextW);
      const descLines = Array.isArray(descRaw) ? descRaw : [String(descRaw)];
      const rows = Math.max(1, descLines.length);
      const blockH = rows * 4 + 2;
      const rowHeight = Math.max(blockH, rowH);
      if (y + rowHeight + rowGapAfterRule > maxY) {
        strokeVerticalGrid(tableTopY, y);
        doc.addPage();
        tableSegmentStartY = M + 8;
        y = drawTableHeader(M + 8);
        tableTopY = tableSegmentStartY - 5;
      }
      doc.setFontSize(9);
      doc.text(descLines, colDesc + 1, y);
      // Same top baseline as first description line (avoids drifting down the cell)
      doc.text(String(item.quantity), qtyX, y, { align: 'right' });
      doc.text(fmtMoney(itemUnitPrice(item)), rateX, y, { align: 'right' });
      doc.text(fmtMoney(n(item.amount)), amtX, y, { align: 'right' });
      y += rowHeight;
      doc.setDrawColor(...gray.line);
      doc.line(M, y, right, y);
      y += rowGapAfterRule;
    }
  } else {
    y += 8;
    doc.setDrawColor(...gray.line);
    doc.line(M, y, right, y);
  }

  strokeVerticalGrid(tableTopY, y);

  y += 4;

  // —— Totals (boxed grid: labels | amounts) ——
  const totalsBoxLeft = vDescQty;
  /** Left edge of label text inside the label column (between totalsBoxLeft and vRateAmt). */
  const labelLeftX = totalsBoxLeft + 2;
  const totalsBoxRight = right;
  const totalsTopY = y;
  doc.setDrawColor(...gray.line);
  doc.line(totalsBoxLeft, totalsTopY, totalsBoxRight, totalsTopY);
  y += 4;

  doc.setFontSize(9);
  doc.text('Subtotal', labelLeftX, y);
  doc.text(fmtMoney(n(invoice.subtotal)), amtX, y, { align: 'right' });
  y += 6;
  doc.setDrawColor(...gray.line);
  doc.line(totalsBoxLeft, y, totalsBoxRight, y);
  y += 4;

  if (n(invoice.discount_amount) > 0) {
    doc.setTextColor(...gray.label);
    doc.text(
      invoice.discount_code ? `Discount (${invoice.discount_code})` : 'Discount',
      labelLeftX,
      y
    );
    doc.setTextColor(0, 0, 0);
    doc.text(`−${fmtMoney(n(invoice.discount_amount))}`, amtX, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(...gray.line);
    doc.line(totalsBoxLeft, y, totalsBoxRight, y);
    y += 4;
  }

  if (n(invoice.tax_amount) > 0) {
    doc.text(`Tax (${n(invoice.tax_rate)}%)`, labelLeftX, y);
    doc.text(fmtMoney(n(invoice.tax_amount)), amtX, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(...gray.line);
    doc.line(totalsBoxLeft, y, totalsBoxRight, y);
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total', labelLeftX, y);
  doc.text(fmtMoney(n(invoice.total)), amtX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.setDrawColor(...gray.line);
  doc.line(totalsBoxLeft, y, totalsBoxRight, y);

  const totalsBottomY = y;
  doc.line(totalsBoxLeft, totalsTopY, totalsBoxLeft, totalsBottomY);
  doc.line(vRateAmt, totalsTopY, vRateAmt, totalsBottomY);
  doc.line(totalsBoxRight, totalsTopY, totalsBoxRight, totalsBottomY);
  y += 4;

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
  const raw = invoice.status as string;
  const statusPdf = raw === 'late' || raw === 'overdue' ? 'LATE' : raw.toUpperCase();
  doc.text(`Status: ${statusPdf}`, right, footY, { align: 'right' });

  const totalPages = doc.getNumberOfPages();
  const pageNumY = pageH - 6;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray.label);
    doc.text(`Page ${p} of ${totalPages}`, right, pageNumY, { align: 'right' });
  }

  return doc;
}
