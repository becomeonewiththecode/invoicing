import { useQuery } from '@tanstack/react-query';
import { getPortalInvoices } from '../../api/portal';
import { StatusBadge } from '../../components/common/StatusBadge';

function money(s: string) {
  return `$${Number(s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PortalInvoicesPage() {
  const q = useQuery({
    queryKey: ['portal-invoices'],
    queryFn: getPortalInvoices,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-700 mt-1 text-sm">
          Draft invoices are not shown. Totals match what your vendor shares with you.
        </p>
      </div>

      {q.isPending && <p className="text-gray-500">Loading invoices…</p>}
      {q.isError && <p className="text-red-600">Could not load invoices.</p>}
      {q.data && q.data.data.length === 0 && (
        <p className="text-gray-600 py-6">No invoices yet.</p>
      )}
      {q.data && q.data.data.length > 0 && (
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Issue</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.data.map((inv) => (
                <tr key={inv.id} className="hover:bg-sky-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status as 'draft' | 'sent' | 'paid' | 'late' | 'cancelled'} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{inv.issue_date?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.due_date?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{money(String(inv.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
