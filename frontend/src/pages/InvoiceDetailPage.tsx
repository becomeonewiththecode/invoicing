import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvoice, deleteInvoice, updateInvoiceStatus } from '../api/invoices';
import { getSettings } from '../api/settings';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { generateInvoicePdf } from '../utils/pdf';
import { formatInvoiceClientLabel } from '../utils/clientDisplay';
import type { InvoiceStatus } from '../types';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-stats'] });
      toast.success('Invoice deleted');
      navigate('/invoices');
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    const doc = await generateInvoicePdf(invoice, companySettings ?? null);
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  if (isPending) return <div className="text-center py-8 text-gray-400">Loading...</div>;
  if (!invoice) return <div className="text-center py-8 text-gray-400">Invoice not found</div>;

  const nextStatusMap: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus }>> = {
    draft: { label: 'Mark as Sent', status: 'sent' },
    sent: { label: 'Mark as Paid', status: 'paid' },
    late: { label: 'Mark as Paid', status: 'paid' },
  };
  const statusKey: InvoiceStatus =
    (invoice.status as string) === 'overdue' ? 'late' : invoice.status;
  const nextAction = nextStatusMap[statusKey];

  return (
    <div>
      <button onClick={() => navigate('/invoices')} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Back to Invoices
      </button>

      <div className="bg-white rounded-xl shadow-sm p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Preview
            </button>
            {invoice.status === 'draft' && (
              <Link
                to={`/invoices/${invoice.id}/edit`}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </Link>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Generate PDF
            </button>
            {invoice.status === 'draft' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this draft invoice?')) deleteMutation.mutate(invoice.id);
                }}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            )}
            {nextAction && (
              <button
                onClick={() => statusMutation.mutate({ status: nextAction.status })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {nextAction.label}
              </button>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Bill To</h3>
            <p className="font-medium text-gray-900">{formatInvoiceClientLabel(invoice)}</p>
            {invoice.client_company?.trim() &&
              invoice.client_name?.trim() &&
              invoice.client_name.trim() !== invoice.client_company.trim() && (
                <p className="text-sm text-gray-600 mt-1">Contact: {invoice.client_name}</p>
              )}
            {invoice.client_email && <p className="text-gray-600 mt-1">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-gray-600">{invoice.client_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Issue Date: <span className="text-gray-900">{invoice.issue_date}</span></p>
            <p className="text-sm text-gray-500">Due Date: <span className="text-gray-900">{invoice.due_date}</span></p>
            {invoice.is_recurring && (
              <p className="text-sm text-blue-600 mt-1">Recurring ({invoice.recurrence_interval})</p>
            )}
          </div>
        </div>

        {/* Table cells use align-middle + same line-height so every row aligns the same */}
        <table className="mb-8 w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-3 text-left align-middle text-xs font-bold uppercase tracking-wide text-gray-500">
                Description
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right align-middle text-xs font-bold uppercase tracking-wide text-gray-500">
                Hours
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right align-middle text-xs font-bold uppercase tracking-wide text-gray-500">
                Rate
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right align-middle text-xs font-bold uppercase tracking-wide text-gray-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-4 py-3 align-middle text-left leading-normal text-gray-900">
                  {item.description}
                </td>
                <td className="border border-gray-300 px-4 py-3 align-middle text-right leading-normal tabular-nums text-gray-900">
                  {item.quantity}
                </td>
                <td className="border border-gray-300 px-4 py-3 align-middle text-right leading-normal tabular-nums text-gray-900">
                  ${Number(item.unit_price ?? item.unitPrice ?? 0).toFixed(2)}
                </td>
                <td className="border border-gray-300 px-4 py-3 align-middle text-right leading-normal tabular-nums font-medium text-gray-900">
                  ${Number(item.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals — align with table: cols 1–2 span, label col 3, amount col 4 */}
        <div className="w-full border border-gray-300 divide-y divide-gray-300">
          <div className="grid grid-cols-4 gap-x-4 gap-y-0 px-4 py-2 text-sm">
            <div className="col-span-2 min-w-0" />
            <div className="text-left text-gray-500">Subtotal</div>
            <div className="text-right tabular-nums pl-2">${Number(invoice.subtotal).toFixed(2)}</div>
          </div>
          {Number(invoice.discount_amount) > 0 && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-0 px-4 py-2 text-sm">
              <div className="col-span-2 min-w-0" />
              <div className="text-left text-gray-500">
                Discount{invoice.discount_code && ` (${invoice.discount_code})`}
              </div>
              <div className="text-right tabular-nums pl-2">-${Number(invoice.discount_amount).toFixed(2)}</div>
            </div>
          )}
          {Number(invoice.tax_amount) > 0 && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-0 px-4 py-2 text-sm">
              <div className="col-span-2 min-w-0" />
              <div className="text-left text-gray-500">Tax ({invoice.tax_rate}%)</div>
              <div className="text-right tabular-nums pl-2">${Number(invoice.tax_amount).toFixed(2)}</div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-x-4 gap-y-0 px-4 py-2 text-base font-bold">
            <div className="col-span-2 min-w-0" />
            <div className="text-left">Total</div>
            <div className="text-right tabular-nums pl-2">${Number(invoice.total).toFixed(2)}</div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            <p className="text-gray-600">{invoice.notes}</p>
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
