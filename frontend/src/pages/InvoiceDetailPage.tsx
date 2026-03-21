import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvoice, updateInvoiceStatus } from '../api/invoices';
import { StatusBadge } from '../components/common/StatusBadge';
import { generateInvoicePdf } from '../utils/pdf';
import { useAuthStore } from '../stores/authStore';
import type { InvoiceStatus } from '../types';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
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

  const handleDownloadPdf = () => {
    if (!invoice) return;
    const doc = generateInvoicePdf(invoice, user?.businessName);
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  if (isLoading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
  if (!invoice) return <div className="text-center py-8 text-gray-400">Invoice not found</div>;

  const nextStatusMap: Partial<Record<InvoiceStatus, { label: string; status: InvoiceStatus }>> = {
    draft: { label: 'Mark as Sent', status: 'sent' },
    sent: { label: 'Mark as Paid', status: 'paid' },
    overdue: { label: 'Mark as Paid', status: 'paid' },
  };
  const nextAction = nextStatusMap[invoice.status];

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
          <div className="flex gap-3">
            <button onClick={handleDownloadPdf} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Download PDF
            </button>
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
            <p className="font-medium">{invoice.client_name}</p>
            {invoice.client_company && <p className="text-gray-600">{invoice.client_company}</p>}
            {invoice.client_email && <p className="text-gray-600">{invoice.client_email}</p>}
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

        {/* Items table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-sm font-medium text-gray-500">Description</th>
              <th className="text-right py-2 text-sm font-medium text-gray-500">Qty</th>
              <th className="text-right py-2 text-sm font-medium text-gray-500">Unit Price</th>
              <th className="text-right py-2 text-sm font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-3">{item.description}</td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right">${(item.unit_price ?? item.unitPrice).toFixed(2)}</td>
                <td className="py-3 text-right">${Number(item.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount{invoice.discount_code && ` (${invoice.discount_code})`}</span>
                <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.tax_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
                <span>${Number(invoice.tax_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total</span>
              <span>${Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            <p className="text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
