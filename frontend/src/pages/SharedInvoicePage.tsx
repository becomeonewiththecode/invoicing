import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import { getSharedInvoice, markSharedInvoicePaid } from '../api/invoices';
import { StatusBadge } from '../components/common/StatusBadge';

export function SharedInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const { data: invoice, isPending, isError } = useQuery({
    queryKey: ['shared-invoice', token],
    queryFn: () => getSharedInvoice(token!),
    enabled: !!token,
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">
        Loading invoice...
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invoice not found</h1>
          <p className="text-gray-500">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  const markPaidMutation = useMutation({
    mutationFn: () => markSharedInvoicePaid(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-invoice', token] });
      toast.success('Invoice marked as paid');
    },
    onError: () => toast.error('Failed to update invoice status'),
  });

  const canMarkPaid = invoice.status === 'sent' || invoice.status === 'late';

  const company = {
    businessName: (invoice as Record<string, unknown>).business_name as string | null,
    businessPhone: (invoice as Record<string, unknown>).business_phone as string | null,
    businessWebsite: (invoice as Record<string, unknown>).business_website as string | null,
    businessAddress: (invoice as Record<string, unknown>).business_address as string | null,
    businessFax: (invoice as Record<string, unknown>).business_fax as string | null,
    logoUrl: (invoice as Record<string, unknown>).logo_url as string | null,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <Toaster position="top-right" />
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        {/* Company header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {company.logoUrl && (
              <img src={company.logoUrl} alt="" className="h-12 mb-3 object-contain" />
            )}
            {company.businessName && (
              <p className="text-lg font-semibold text-gray-900">{company.businessName}</p>
            )}
            {company.businessAddress && (
              <p className="text-sm text-gray-500 whitespace-pre-line">{company.businessAddress}</p>
            )}
            {company.businessPhone && (
              <p className="text-sm text-gray-500">{company.businessPhone}</p>
            )}
            {company.businessWebsite && (
              <p className="text-sm text-gray-500">{company.businessWebsite}</p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
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
            <h3 className="text-sm font-medium text-gray-500 mb-2">Bill To</h3>
            <p className="font-medium text-gray-900">
              {invoice.client_company || invoice.client_name}
            </p>
            {invoice.client_company && invoice.client_name && invoice.client_name !== invoice.client_company && (
              <p className="text-sm text-gray-600 mt-1">Contact: {invoice.client_name}</p>
            )}
            {invoice.client_email && <p className="text-gray-600 mt-1">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-gray-600">{invoice.client_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Issue Date: <span className="text-gray-900">{invoice.issue_date}</span>
            </p>
            <p className="text-sm text-gray-500">
              Due Date: <span className="text-gray-900">{invoice.due_date}</span>
            </p>
          </div>
        </div>

        {/* Line items + totals in one table so footer columns match Rate / Amount */}
        <table className="mb-8 w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                Description
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                Qty
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                Rate
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-4 py-3 text-gray-900">{item.description}</td>
                <td className="border border-gray-300 px-4 py-3 text-right tabular-nums text-gray-900">
                  {item.quantity}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right tabular-nums text-gray-900">
                  ${Number(item.unit_price ?? item.unitPrice ?? 0).toFixed(2)}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                  ${Number(item.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50/80">
            <tr>
              <td colSpan={2} className="border border-gray-300" aria-hidden />
              <td className="border border-gray-300 px-4 py-2 text-left text-gray-500">Subtotal</td>
              <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-gray-900">
                ${Number(invoice.subtotal).toFixed(2)}
              </td>
            </tr>
            {Number(invoice.discount_amount) > 0 && (
              <tr>
                <td colSpan={2} className="border border-gray-300" aria-hidden />
                <td className="border border-gray-300 px-4 py-2 text-left text-gray-500">
                  Discount{invoice.discount_code && ` (${invoice.discount_code})`}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-gray-900">
                  -${Number(invoice.discount_amount).toFixed(2)}
                </td>
              </tr>
            )}
            {Number(invoice.tax_amount) > 0 && (
              <tr>
                <td colSpan={2} className="border border-gray-300" aria-hidden />
                <td className="border border-gray-300 px-4 py-2 text-left text-gray-500">Tax ({invoice.tax_rate}%)</td>
                <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-gray-900">
                  ${Number(invoice.tax_amount).toFixed(2)}
                </td>
              </tr>
            )}
            <tr className="font-bold text-base">
              <td colSpan={2} className="border border-gray-300" aria-hidden />
              <td className="border border-gray-300 px-4 py-2 text-left text-gray-900">Total</td>
              <td className="border border-gray-300 px-4 py-2 text-right tabular-nums text-gray-900">
                ${Number(invoice.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            <p className="text-gray-600 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
