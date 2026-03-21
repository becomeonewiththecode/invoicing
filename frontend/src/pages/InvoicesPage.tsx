import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getInvoices, deleteInvoice, exportInvoicesCsv } from '../api/invoices';
import { StatusBadge } from '../components/common/StatusBadge';

export function InvoicesPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page],
    queryFn: () => getInvoices(page),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted');
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const handleExport = async () => {
    try {
      const blob = await exportInvoicesCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export');
    }
  };

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.limit) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex gap-3">
          <button onClick={handleExport} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Export CSV
          </button>
          <Link to="/invoices/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            New Invoice
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Invoice #</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Client</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Due Date</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Total</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No invoices found</td></tr>
            ) : (
              data?.data.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                  <td className="px-6 py-4 font-medium">{invoice.invoice_number}</td>
                  <td className="px-6 py-4 text-gray-600">{invoice.client_name}</td>
                  <td className="px-6 py-4"><StatusBadge status={invoice.status} /></td>
                  <td className="px-6 py-4 text-gray-600">{invoice.due_date}</td>
                  <td className="px-6 py-4 text-right font-medium">${Number(invoice.total).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    {invoice.status === 'draft' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this draft invoice?')) deleteMutation.mutate(invoice.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
