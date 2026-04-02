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
        <h1 className="text-2xl font-bold text-text">Invoices</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Draft invoices are not shown. Totals match what your vendor shares with you.
        </p>
      </div>

      {q.isPending && <p className="text-text-muted">Loading invoices…</p>}
      {q.isError && <p className="text-red-600">Could not load invoices.</p>}
      {q.data && q.data.data.length === 0 && (
        <p className="text-text-secondary py-6">No invoices yet.</p>
      )}
      {q.data && q.data.data.length > 0 && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-surface-alt border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Issue</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Due</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.data.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface-alt/50">
                  <td className="px-4 py-3 font-medium text-text">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status as 'draft' | 'sent' | 'paid' | 'late' | 'cancelled'} />
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{inv.issue_date?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{inv.due_date?.slice(0, 10) ?? '—'}</td>
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
