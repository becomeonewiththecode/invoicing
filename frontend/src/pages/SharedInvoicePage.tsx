import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import { getSharedInvoice, markSharedInvoicePaid } from '../api/invoices';
import { StatusBadge } from '../components/common/StatusBadge';
import { ExternalLinksList } from '../components/ExternalLinksList';
import { LinkifiedText } from '../components/LinkifiedText';
import { externalLinksFromInvoicePayload } from '../utils/externalLinksDisplay';

export function SharedInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const { data: invoice, isPending, isError } = useQuery({
    queryKey: ['shared-invoice', token],
    queryFn: () => getSharedInvoice(token!),
    enabled: !!token,
  });

  const markPaidMutation = useMutation({
    mutationFn: () => markSharedInvoicePaid(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-invoice', token] });
      toast.success('Invoice marked as paid');
    },
    onError: () => toast.error('Failed to update invoice status'),
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-alt text-text-faint">
        Loading invoice...
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-alt">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-2">Invoice not found</h1>
          <p className="text-text-muted">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  const canMarkPaid = invoice.status === 'sent' || invoice.status === 'late';

  const inv = invoice as unknown as Record<string, unknown>;
  const company = {
    businessName: inv.business_name as string | null,
    businessPhone: inv.business_phone as string | null,
    businessWebsite: inv.business_website as string | null,
    businessAddress: inv.business_address as string | null,
    businessFax: inv.business_fax as string | null,
    logoUrl: inv.logo_url as string | null,
  };

  return (
    <div className="min-h-screen bg-surface-alt py-10 px-4">
      <Toaster position="top-right" />
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        {/* Company header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {company.logoUrl && (
              <img src={company.logoUrl} alt="" className="h-12 mb-3 object-contain" />
            )}
            {company.businessName && (
              <p className="text-lg font-semibold text-text">{company.businessName}</p>
            )}
            {company.businessAddress && (
              <p className="text-sm text-text-muted whitespace-pre-line">{company.businessAddress}</p>
            )}
            {company.businessPhone && (
              <p className="text-sm text-text-muted">{company.businessPhone}</p>
            )}
            {company.businessWebsite && (
              <p className="text-sm text-text-muted">
                {/^https?:\/\//i.test(company.businessWebsite.trim()) ? (
                  <a
                    href={company.businessWebsite.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {company.businessWebsite.trim()}
                  </a>
                ) : (
                  company.businessWebsite
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-text">{invoice.invoice_number}</h1>
            <div className="flex items-center justify-end gap-3 mt-1">
              <StatusBadge status={invoice.status} />
              {canMarkPaid && (
                <button
                  type="button"
                  disabled={markPaidMutation.isPending}
                  onClick={() => markPaidMutation.mutate()}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {markPaidMutation.isPending ? 'Updating...' : 'Mark as Paid'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-medium text-text-muted mb-2">Bill To</h3>
            <p className="font-medium text-text">
              {invoice.client_company || invoice.client_name}
            </p>
            {invoice.client_company && invoice.client_name && invoice.client_name !== invoice.client_company && (
              <p className="text-sm text-gray-600 mt-1">Contact: {invoice.client_name}</p>
            )}
            {invoice.client_email && <p className="text-gray-600 mt-1">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-gray-600">{invoice.client_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">
              Issue Date: <span className="text-text">{invoice.issue_date}</span>
            </p>
            <p className="text-sm text-text-muted">
              Due Date: <span className="text-text">{invoice.due_date}</span>
            </p>
          </div>
        </div>

        {/* Line items + totals in one table so footer columns match Rate / Amount */}
        <table className="mb-8 w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-surface-alt">
              <th className="border border-gray-300 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-text-muted">
                Description
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-text-muted">
                Qty
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-text-muted">
                Rate
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-text-muted">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-4 py-3 text-text">
                  <LinkifiedText text={item.description} preserveLineBreaks />
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right tabular-nums text-text">
                  {item.quantity}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right tabular-nums text-text">
                  ${Number(item.unit_price ?? item.unitPrice ?? 0).toFixed(2)}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right tabular-nums font-medium text-text">
                  ${Number(item.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-alt/80">
            <tr>
              <td colSpan={2} className="border border-gray-300" aria-hidden />
              <td className="border border-gray-300 px-4 py-2 text-left text-text-muted">Subtotal</td>
              <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-text">
                ${Number(invoice.subtotal).toFixed(2)}
              </td>
            </tr>
            {Number(invoice.discount_amount) > 0 && (
              <tr>
                <td colSpan={2} className="border border-gray-300" aria-hidden />
                <td className="border border-gray-300 px-4 py-2 text-left text-text-muted">
                  Discount{invoice.discount_code && ` (${invoice.discount_code})`}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-text">
                  -${Number(invoice.discount_amount).toFixed(2)}
                </td>
              </tr>
            )}
            {Number(invoice.tax_amount) > 0 && (
              <tr>
                <td colSpan={2} className="border border-gray-300" aria-hidden />
                <td className="border border-gray-300 px-4 py-2 text-left text-text-muted">Tax ({invoice.tax_rate}%)</td>
                <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-text">
                  ${Number(invoice.tax_amount).toFixed(2)}
                </td>
              </tr>
            )}
            <tr className="font-bold text-base">
              <td colSpan={2} className="border border-gray-300" aria-hidden />
              <td className="border border-gray-300 px-4 py-2 text-left text-text">Total</td>
              <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-text">
                ${Number(invoice.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {(invoice.notes?.trim() || externalLinksFromInvoicePayload(invoice.project_external_links).length > 0) && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-text-muted mb-2">Notes</h3>
            {invoice.notes?.trim() ? (
              <p className="text-gray-600 whitespace-pre-line">
                <LinkifiedText text={invoice.notes} preserveLineBreaks />
              </p>
            ) : null}
            <ExternalLinksList
              links={externalLinksFromInvoicePayload(invoice.project_external_links)}
              className={`text-sm space-y-1 list-none pl-0 ${invoice.notes?.trim() ? 'mt-3' : 'mt-0'}`}
            />
          </div>
        )}

        {invoice.payable_text?.trim() && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-text-muted mb-2">Pay to</h3>
            <p className="text-gray-700 whitespace-pre-line">{invoice.payable_text.trim()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
