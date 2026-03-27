import { jsPDF } from 'jspdf';
import type { Project, ProjectMilestone } from '../api/projects';

const M = 16;
const LINE = 4.5;
const SECTION_GAP = 6;
const gray: [number, number, number] = [88, 88, 88];
const ink: [number, number, number] = [33, 33, 33];

function safeName(s: string): string {
  return s.replace(/[^\w\s-]+/g, '').replace(/\s+/g, '-').slice(0, 80) || 'project';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

function milestoneRows(m: unknown): { title: string; due?: string }[] {
  if (!Array.isArray(m)) return [];
  return (m as ProjectMilestone[]).map((x) => ({
    title: String(x?.title ?? ''),
    due: x?.due_date ? String(x.due_date).slice(0, 10) : undefined,
  }));
}

function addParagraph(
  doc: jsPDF,
  y: number,
  text: string,
  pageW: number,
  pageH: number,
  fontSize = 9
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);
  const w = pageW - 2 * M;
  const lines = doc.splitTextToSize(text, w);
  for (const line of lines) {
    if (y > pageH - M - LINE) {
      doc.addPage();
      y = M;
    }
    doc.text(line, M, y);
    y += LINE;
  }
  return y;
}

function addSection(
  doc: jsPDF,
  y: number,
  title: string,
  pageW: number,
  pageH: number
): number {
  if (y > pageH - M - SECTION_GAP - LINE * 2) {
    doc.addPage();
    y = M;
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(title, M, y);
  y += LINE + 1;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(M, y, pageW - M, y);
  y += 3;
  return y;
}

function addField(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  pageW: number,
  pageH: number
): number {
  const valueW = pageW - M - 44;
  const display = value?.trim() ? value : '—';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(label, M, y);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(display, valueW);
  let yy = y;
  for (const ln of lines) {
    if (yy > pageH - M - LINE) {
      doc.addPage();
      yy = M;
    }
    doc.text(ln, M + 44, yy);
    yy += LINE;
  }
  return yy + 1;
}

function getExternalLinksForPdf(project: Project): { url: string; description?: string | null }[] {
  const list = project.external_links;
  if (list && list.length > 0) {
    return [...list]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((l) => ({ url: l.url.trim(), description: l.description }));
  }
  if (project.external_link?.trim()) {
    return [{ url: project.external_link.trim(), description: project.external_link_description ?? null }];
  }
  return [];
}

/** One row: rowLabel (e.g. Document / Document 2) + clickable text (description or URL). */
function addExternalLinkRow(
  doc: jsPDF,
  y: number,
  rowLabel: string,
  url: string,
  linkDescription: string | undefined,
  pageW: number,
  pageH: number
): number {
  if (y > pageH - M - LINE * 3) {
    doc.addPage();
    y = M;
  }
  const valueW = pageW - M - 44;
  const displayText = linkDescription?.trim() ? linkDescription.trim() : url;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(rowLabel, M, y);

  doc.setFontSize(9);
  const linkRgb: [number, number, number] = [0, 0, 200];
  doc.setTextColor(...linkRgb);
  const lines = doc.splitTextToSize(displayText, valueW);
  if (y + lines.length * LINE > pageH - M) {
    doc.addPage();
    y = M;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(rowLabel, M, y);
    doc.setFontSize(9);
    doc.setTextColor(...linkRgb);
  }

  doc.textWithLink(displayText, M + 44, y, { url, maxWidth: valueW });
  doc.setTextColor(0, 0, 0);

  return y + lines.length * LINE + 2;
}

/**
 * Project summary PDF (jsPDF), aligned with invoice PDF styling.
 * Exported for preview modals; prefer `downloadProjectPdf` / blob helpers for downloads.
 */
export function generateProjectPdf(project: Project, clientName?: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let y = M;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...ink);
  doc.text('PROJECT', M, y + 8);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name || 'Untitled project', M, y);
  y += LINE + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  const meta: string[] = [];
  if (clientName) meta.push(`Client: ${clientName}`);
  if (project.updated_at) {
    try {
      const d = new Date(project.updated_at);
      meta.push(`Updated ${d.toLocaleString()}`);
    } catch {
      meta.push(`Updated ${project.updated_at}`);
    }
  }
  if (meta.length) {
    doc.text(meta.join(' · '), M, y);
    y += LINE + 2;
  }

  y = addSection(doc, y, 'Overview', pageW, pageH);
  y = addField(doc, y, 'Client', clientName || '—', pageW, pageH);
  y = addField(doc, y, 'Status', statusLabel(project.status), pageW, pageH);
  y = addField(doc, y, 'Priority', project.priority, pageW, pageH);
  y = addField(doc, y, 'Start', fmtDate(project.start_date), pageW, pageH);
  y = addField(doc, y, 'End', fmtDate(project.end_date), pageW, pageH);

  const hoursStr =
    project.hours != null && project.hours !== ''
      ? `${Number(project.hours).toLocaleString(undefined, { maximumFractionDigits: 2 })}${
          project.hours_is_maximum ? ' (maximum)' : ''
        }`
      : '—';
  y = addField(doc, y, 'Hours', hoursStr, pageW, pageH);

  const budgetStr =
    project.budget != null && project.budget !== ''
      ? `$${Number(project.budget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
  y = addField(doc, y, 'Budget', budgetStr, pageW, pageH);

  if (project.description?.trim()) {
    y = addSection(doc, y, 'Description', pageW, pageH);
    y = addParagraph(doc, y, project.description.trim(), pageW, pageH);
  }

  const extLinks = getExternalLinksForPdf(project);
  if (extLinks.length > 0) {
    y = addSection(doc, y, 'Documents', pageW, pageH);
    extLinks.forEach((item, i) => {
      const rowLabel = extLinks.length > 1 ? `Document ${i + 1}` : 'Document';
      y = addExternalLinkRow(
        doc,
        y,
        rowLabel,
        item.url,
        item.description ?? undefined,
        pageW,
        pageH
      );
    });
  }

  const team = project.team_members?.filter(Boolean).join(', ');
  if (team) {
    y = addSection(doc, y, 'Team', pageW, pageH);
    y = addParagraph(doc, y, team, pageW, pageH);
  }

  const tags = project.tags?.filter(Boolean).join(', ');
  if (tags) {
    y = addSection(doc, y, 'Tags', pageW, pageH);
    y = addParagraph(doc, y, tags, pageW, pageH);
  }

  if (project.dependencies?.trim()) {
    y = addSection(doc, y, 'Dependencies', pageW, pageH);
    y = addParagraph(doc, y, project.dependencies.trim(), pageW, pageH);
  }

  const miles = milestoneRows(project.milestones).filter((m) => m.title.trim());
  if (miles.length) {
    y = addSection(doc, y, 'Milestones', pageW, pageH);
    for (const m of miles) {
      const line = m.due ? `${m.title} — due ${m.due}` : m.title;
      y = addParagraph(doc, y, `• ${line}`, pageW, pageH);
    }
  }

  if (project.notes?.trim()) {
    y = addSection(doc, y, 'Notes', pageW, pageH);
    y = addParagraph(doc, y, project.notes.trim(), pageW, pageH);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  return doc;
}

/** Same PDF bytes used for preview (iframe) and download — always call `generateProjectPdf` once per blob. */
export function buildProjectPdfBlob(project: Project, clientName?: string): Blob {
  const doc = generateProjectPdf(project, clientName);
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

export function downloadProjectPdf(project: Project, clientName?: string): void {
  const blob = buildProjectPdfBlob(project, clientName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(project.name)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
