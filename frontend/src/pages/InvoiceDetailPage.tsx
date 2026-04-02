import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvoice, deleteInvoice, updateInvoiceStatus, sendInvoiceToCompanyEmail, createShareLink, revokeShareLink } from '../api/invoices';
import { getSettings } from '../api/settings';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { ExternalLinksList } from '../components/ExternalLinksList';
import { LinkifiedText } from '../components/LinkifiedText';
import { StatusBadge } from '../components/common/StatusBadge';
import { externalLinksFromInvoicePayload } from '../utils/externalLinksDisplay';
import { generateInvoicePdf } from '../utils/pdf';
import { formatInvoiceClientLabel } from '../utils/clientDisplay';
import type { InvoiceStatus } from '../types';
import axios from 'axios';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const { data: invoice, isPending } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: InvoiceStatus }) => updateInvoiceStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-stats'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const emailToCompanyMutation = useMutation({
    mutationFn: () => sendInvoiceToCompanyEmail(id!),
    onSuccess: (data) => {
      toast.success(`Invoice emailed to ${data.sentTo}`);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      toast.error(msg || 'Failed to send email');
    },
  });

  const shareMutation = useMutation({
    mutationFn: () => createShareLink(id!),
    onSuccess: ({ token }) => {
      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).then(
        () => toast.success('Share link copied to clipboard'),
        () => toast.success('Share link created')
      );
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: () => toast.error('Failed to create share link'),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeShareLink(id!),
    onSuccess: () => {
      setShareUrl(null);
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      toast.success('Share link revoked');
    },
    onError: () => toast.error('Failed to revoke share link'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['revenue-stats'] });
      toast.success(invoice?.status === 'draft' ? 'Invoice deleted' : 'Invoice cancelled');
      if (invoice?.status === 'draft') {
        navigate('/invoices');
      }
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    const doc = await generateInvoicePdf(invoice, companySettings ?? null);
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  if (isPending) return <div className="text-center py-8 text-text-faint">Loading...</div>;
  if (!invoice) return <div className="text-center py-8 text-text-faint">Invoice not found</div>;

  const nextStatusMap: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus }>> = {
    draft: { label: 'Mark as Sent', status: 'sent' },
    sent: { label: 'Mark as Paid', status: 'paid' },
    late: { label: 'Mark as Paid', status: 'paid' },
  };
  const statusKey: InvoiceStatus =
    (invoice.status as string) === 'overdue' ? 'late' : invoice.status;
  const nextAction = nextStatusMap[statusKey];

  const publicShareDisplayUrl =
    invoice.share_token != null && invoice.share_token !== ''
      ? `${window.location.origin}/share/${invoice.share_token}`
      : shareUrl;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm">
        <button type="button" onClick={() => navigate('/invoices')} className="text-text-muted hover:text-text-secondary">
          &larr; Back to Invoices
        </button>
        <span className="text-text-faint" aria-hidden>
          |
        </span>
        <Link
          to={`/clients/${encodeURIComponent(invoice.client_id)}`}
          className="text-primary hover:text-primary-hover font-medium"
        >
          Client profile
        </Link>
      </div>

      <div className="bg-surface rounded-xl shadow-sm p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} />
            {invoice.project_name ? (
              <p className="text-sm text-text-secondary mt-2">
                Project:{' '}
                <Link
                  to={`/clients/${encodeURIComponent(invoice.client_id)}#projects`}
                  className="text-primary hover:underline"
                >
                  {invoice.project_name}
                </Link>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary-light transition-colors"
            >
              Preview
            </button>
            {invoice.status === 'draft' && (
              <Link
                to={`/invoices/${invoice.id}/edit`}
                className="px-4 py-2 border border-input-border rounded-lg hover:bg-surface-alt transition-colors"
              >
                Edit
              </Link>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 border border-input-border rounded-lg hover:bg-surface-alt transition-colors"
            >
              Generate PDF
            </button>
            <button
              type="button"
              disabled={emailToCompanyMutation.isPending}
              onClick={() => emailToCompanyMutation.mutate()}
              className="px-4 py-2 border border-input-border rounded-lg hover:bg-surface-alt transition-colors disabled:opacity-50"
            >
              {emailToCompanyMutation.isPending ? 'Sending…' : 'Email to company'}
            </button>
            {['draft', 'sent', 'late'].includes(invoice.status) && (
              <button
                type="button"
                onClick={() => {
                  const msg = invoice.status === 'draft'
                    ? 'Delete this draft invoice? This cannot be undone.'
                    : 'Cancel this invoice? It will be marked as cancelled and any share link will be revoked.';
                  if (confirm(msg)) deleteMutation.mutate(invoice.id);
                }}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                {invoice.status === 'draft' ? 'Delete' : 'Cancel invoice'}
              </button>
            )}
            {nextAction && (
              <button
                onClick={() => statusMutation.mutate({ status: nextAction.status })}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                {nextAction.label}
              </button>
            )}
          </div>
        </div>

        {/* Public share link — separate block so it is not lost in the action row */}
        <div className="mb-8 rounded-lg border border-border bg-surface-alt p-4">
          <h2 className="text-sm font-semibold text-text">Public share link</h2>
          <p className="text-xs text-text-secondary mt-1 mb-3">
            Create a link anyone can open to view this invoice (no login). Paste it into email or chat.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={shareMutation.isPending}
              onClick={() => {
                if (invoice.share_token) {
                  const url = `${window.location.origin}/share/${invoice.share_token}`;
                  navigator.clipboard.writeText(url).then(
                    () => toast.success('Share link copied to clipboard'),
                    () => {
                      setShareUrl(url);
                      toast.success('Share link ready');
                    }
                  );
                } else {
                  shareMutation.mutate();
                }
              }}
              className="px-4 py-2 border border-input-border bg-surface rounded-lg hover:bg-surface-alt transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {shareMutation.isPending ? 'Creating…' : invoice.share_token ? 'Copy share link' : 'Create share link'}
            </button>
            {publicShareDisplayUrl && (
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
                className="px-4 py-2 border border-orange-300 text-orange-700 bg-white rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 text-sm"
              >
                {revokeMutation.isPending ? 'Revoking…' : 'Revoke link'}
              </button>
            )}
          </div>
          {publicShareDisplayUrl && (
            <p className="mt-3 text-xs font-mono break-all bg-surface border border-border rounded px-3 py-2">
              <a
                href={publicShareDisplayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {publicShareDisplayUrl}
              </a>
            </p>
          )}
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <h3 className="text-sm font-medium text-text-muted">Bill To</h3>
              <Link
                to={`/clients?edit=${encodeURIComponent(invoice.client_id)}`}
                className="text-xs font-medium text-primary hover:text-primary-hover hover:underline"
              >
                Client profile
              </Link>
            </div>
            <p className="font-medium text-text">{formatInvoiceClientLabel(invoice)}</p>
            {invoice.client_company?.trim() &&
              invoice.client_name?.trim() &&
              invoice.client_name.trim() !== invoice.client_company.trim() && (
                <p className="text-sm text-text-secondary mt-1">Contact: {invoice.client_name}</p>
              )}
            {invoice.client_email && <p className="text-text-secondary mt-1">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-text-secondary">{invoice.client_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">Issue Date: <span className="text-text">{invoice.issue_date}</span></p>
            <p className="text-sm text-text-muted">Due Date: <span className="text-text">{invoice.due_date}</span></p>
            {invoice.is_recurring && (
              <p className="text-sm text-primary mt-1">Recurring ({invoice.recurrence_interval})</p>
            )}
          </div>
        </div>

        {/* Totals live in tfoot so columns align with line items (grid-cols-4 used equal widths and did not match the table). */}
        <table className="mb-8 w-full border-collapse border border-input-border text-sm">
          <thead>
            <tr className="bg-surface-alt">
              <th className="border border-input-border px-4 py-3 text-left align-middle text-xs font-bold uppercase tracking-wide text-text-muted">
                Description
              </th>
              <th className="border border-input-border px-4 py-3 text-right align-middle text-xs font-bold uppercase tracking-wide text-text-muted">
                Hours
              </th>
              <th className="border border-input-border px-4 py-3 text-right align-middle text-xs font-bold uppercase tracking-wide text-text-muted">
                Rate
              </th>
              <th className="border border-input-border px-4 py-3 text-right align-middle text-xs font-bold uppercase tracking-wide text-text-muted">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, i) => (
              <tr key={i}>
                <td className="border border-input-border px-4 py-3 align-middle text-left leading-normal text-text">
                  <LinkifiedText text={item.description} preserveLineBreaks />
                </td>
                <td className="border border-input-border px-4 py-3 align-middle text-right leading-normal tabular-nums text-text">
                  {item.quantity}
                </td>
                <td className="border border-input-border px-4 py-3 align-middle text-right leading-normal tabular-nums text-text">
                  ${Number(item.unit_price ?? item.unitPrice ?? 0).toFixed(2)}
                </td>
                <td className="border border-input-border px-4 py-3 align-middle text-right leading-normal tabular-nums font-medium text-text">
                  ${Number(item.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-alt/80">
            <tr>
              <td colSpan={2} className="border border-input-border" aria-hidden />
              <td className="border border-input-border px-4 py-2 align-middle text-left text-text-muted">Subtotal</td>
              <td className="border border-input-border px-4 py-2 align-middle text-right tabular-nums text-text">
                ${Number(invoice.subtotal).toFixed(2)}
              </td>
            </tr>
            {Number(invoice.discount_amount) > 0 && (
              <tr>
                <td colSpan={2} className="border border-input-border" aria-hidden />
                <td className="border border-input-border px-4 py-2 align-middle text-left text-text-muted">
                  Discount{invoice.discount_code && ` (${invoice.discount_code})`}
                </td>
                <td className="border border-input-border px-4 py-2 align-middle text-right tabular-nums text-text">
                  -${Number(invoice.discount_amount).toFixed(2)}
                </td>
              </tr>
            )}
            {Number(invoice.tax_amount) > 0 && (
              <tr>
                <td colSpan={2} className="border border-input-border" aria-hidden />
                <td className="border border-input-border px-4 py-2 align-middle text-left text-text-muted">
                  Tax ({invoice.tax_rate}%)
                </td>
                <td className="border border-input-border px-4 py-2 align-middle text-right tabular-nums text-text">
                  ${Number(invoice.tax_amount).toFixed(2)}
                </td>
              </tr>
            )}
            <tr className="font-bold text-base">
              <td colSpan={2} className="border border-input-border" aria-hidden />
              <td className="border border-input-border px-4 py-2 align-middle text-left text-text">Total</td>
              <td className="border border-input-border px-4 py-2 align-middle text-right tabular-nums text-text">
                ${Number(invoice.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {(invoice.notes?.trim() || externalLinksFromInvoicePayload(invoice.project_external_links).length > 0) && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-text-muted mb-2">Notes</h3>
            {invoice.notes?.trim() ? (
              <p className="text-text-secondary whitespace-pre-line">
                <LinkifiedText text={invoice.notes} preserveLineBreaks />
              </p>
            ) : null}
            <ExternalLinksList
              links={externalLinksFromInvoicePayload(invoice.project_external_links)}
              className={`text-sm space-y-1 list-none pl-0 ${invoice.notes?.trim() ? 'mt-3' : 'mt-0'}`}
            />
          </div>
        )}

        {companySettings?.payableText?.trim() && (
          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-text-muted mb-2">Pay to</h3>
            <p className="text-text-secondary whitespace-pre-line">{companySettings.payableText.trim()}</p>
          </div>
        )}
      </div>

      <InvoicePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoice={invoice}
        company={companySettings ?? null}
        variant="saved"
        title={`Preview — ${invoice.invoice_number}`}
      />
    </div>
  );
}
