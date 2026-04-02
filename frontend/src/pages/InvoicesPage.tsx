import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getInvoices, getInvoice, deleteInvoice, exportInvoicesCsv } from '../api/invoices';
import { getClient, getClients } from '../api/clients';
import { getSettings } from '../api/settings';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatClientLabel, formatInvoiceClientLabel } from '../utils/clientDisplay';

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientIdFilter = searchParams.get('clientId') || undefined;

  const [page, setPage] = useState(1);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clientIdFilter ?? '');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    setPage(1);
  }, [clientIdFilter]);

  useEffect(() => {
    setSelectedClientId(clientIdFilter ?? '');
  }, [clientIdFilter]);

  const clientQuery = useQuery({
    queryKey: ['client', clientIdFilter],
    queryFn: () => getClient(clientIdFilter!),
    enabled: !!clientIdFilter,
    retry: false,
  });
  const filterClient = clientQuery.data;
  const filterClientMissing = clientQuery.isError;

  const clientsQuery = useQuery({
    queryKey: ['clients', 'invoice-filter'],
    queryFn: () => getClients(1, 100),
  });

  const {
    data,
    isPending: invoicesPending,
    isError: invoicesError,
  } = useQuery({
    queryKey: ['invoices', page, clientIdFilter],
    queryFn: () => getInvoices(page, 20, clientIdFilter),
    enabled: !clientIdFilter || clientQuery.isSuccess,
    retry: false,
  });

  const showLoading = (clientIdFilter && clientQuery.isPending) || invoicesPending;

  const { data: previewInvoice } = useQuery({
    queryKey: ['invoice', previewId],
    queryFn: () => getInvoice(previewId!),
    enabled: !!previewId,
  });

  const { data: previewSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: !!previewId,
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

  const clearClientFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('clientId');
    setSearchParams(next, { replace: true });
  };

  const applyClientFilter = (clientId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('clientId', clientId);
    setSearchParams(next, { replace: true });
  };

  const applySelectedClientFilter = () => {
    if (!selectedClientId) {
      clearClientFilter();
      setFilterPickerOpen(false);
      return;
    }
    applyClientFilter(selectedClientId);
    setFilterPickerOpen(false);
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button onClick={handleExport} className="px-4 py-2 border border-input-border rounded-lg hover:bg-surface-alt transition-colors">
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setFilterPickerOpen((prev) => !prev)}
            className="px-4 py-2 border border-input-border rounded-lg hover:bg-surface-alt transition-colors"
          >
            Filter by customer
          </button>
          <Link to="/invoices/new" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
            Create invoice
          </Link>
        </div>
      </div>

      {filterPickerOpen && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-sm font-medium text-text-secondary">Customer</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border border-input-border px-3 py-2 text-sm"
              >
                <option value="">All customers</option>
                {clientsQuery.data?.data.map((client) => (
                  <option key={client.id} value={client.id}>
                    {formatClientLabel(client)}
                  </option>
                ))}
              </select>
              {clientsQuery.isError && (
                <p className="mt-1 text-xs text-red-600">Could not load customers.</p>
              )}
            </div>
            <button
              type="button"
              onClick={applySelectedClientFilter}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm font-medium"
            >
              Apply filter
            </button>
            <button
              type="button"
              onClick={() => {
                clearClientFilter();
                setSelectedClientId('');
              }}
              className="px-4 py-2 rounded-lg border border-input-border hover:bg-surface-alt text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {clientIdFilter && filterClientMissing && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800">
          <span>That client could not be found.</span>
          <button type="button" onClick={clearClientFilter} className="font-medium underline hover:no-underline">
            Clear filter
          </button>
        </div>
      )}

      {clientIdFilter && filterClient && !filterClientMissing && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-primary-light border border-primary-light-border rounded-lg text-sm">
          <p className="text-text">
            Showing invoices for{' '}
            <span className="font-semibold">{formatClientLabel(filterClient)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/clients/${encodeURIComponent(clientIdFilter)}#invoice-status`}
              className="text-primary font-medium hover:underline"
            >
              Client profile
            </Link>
            <button
              type="button"
              onClick={clearClientFilter}
              className="text-primary font-medium hover:underline"
            >
              Show all invoices
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-alt border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Invoice #</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Client</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Status</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Due Date</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-text-muted">Total</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoicesError ? (
              <tr><td colSpan={6} className="text-center py-8 text-red-600">Could not load invoices.</td></tr>
            ) : showLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-text-faint">Loading...</td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-text-faint">No invoices found</td></tr>
            ) : (
              data?.data.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-surface-alt cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                  <td className="px-6 py-4 font-medium">{invoice.invoice_number}</td>
                  <td className="px-6 py-4 text-text-secondary">{formatInvoiceClientLabel(invoice)}</td>
                  <td className="px-6 py-4"><StatusBadge status={invoice.status} /></td>
                  <td className="px-6 py-4 text-text-secondary">{invoice.due_date}</td>
                  <td className="px-6 py-4 text-right font-medium">${Number(invoice.total).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewId(invoice.id);
                      }}
                      className="text-text-secondary hover:text-text text-sm font-medium"
                    >
                      Preview
                    </button>
                    {invoice.status === 'draft' && (
                      <>
                        <Link
                          to={`/invoices/${invoice.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:text-primary-hover text-sm font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this draft invoice?')) deleteMutation.mutate(invoice.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </>
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
            <span className="px-3 py-1 text-text-secondary">Page {page} of {totalPages}</span>
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

      <InvoicePreviewModal
        open={!!previewId}
        onClose={() => setPreviewId(null)}
        invoice={previewInvoice ?? null}
        company={previewSettings ?? null}
        variant="saved"
        title="Invoice preview"
      />
    </div>
  );
}
