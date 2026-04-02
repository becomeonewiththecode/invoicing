import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { getPortalMe, getPortalNotifications } from '../../api/portal';

function money(s: string) {
  return `$${Number(s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PortalDashboardPage() {
  const meQuery = useQuery({
    queryKey: ['portal-me'],
    queryFn: getPortalMe,
  });

  const notifQuery = useQuery({
    queryKey: ['portal-notifications'],
    queryFn: getPortalNotifications,
    refetchInterval: 60_000,
  });

  if (meQuery.isPending) {
    return <p className="text-text-secondary">Loading your dashboard…</p>;
  }
  if (meQuery.isError || !meQuery.data) {
    return <p className="text-red-600">Could not load dashboard.</p>;
  }

  const { client, vendor, stats } = meQuery.data;
  const clientDisplayName = client.company?.trim() || client.name;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Welcome, {clientDisplayName}</h1>
        <p className="text-text-secondary mt-1">
          {vendor.businessName ? `${vendor.businessName} · ` : ''}
          Account overview and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Open invoices</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-primary">{stats.openInvoices}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Outstanding balance</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-primary">
            {money(stats.outstandingTotal)}
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Visible invoices</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-text">{stats.visibleInvoices}</p>
        </div>
        <div className="bg-surface rounded-xl border border-input-border p-5 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">Projects</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-text">{stats.projectCount}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-text mb-3">Recent activity</h2>
        <p className="text-sm text-text-secondary mb-3">
          Updates refresh about every minute while this page is open.
        </p>
        {notifQuery.isPending && <p className="text-text-muted">Loading activity…</p>}
        {notifQuery.isError && <p className="text-red-600">Could not load activity.</p>}
        {notifQuery.data && notifQuery.data.data.length === 0 && (
          <p className="text-text-secondary py-4">No recent invoice or project updates.</p>
        )}
        {notifQuery.data && notifQuery.data.data.length > 0 && (
          <ul className="bg-surface rounded-xl border border-border divide-y divide-border shadow-sm">
            {notifQuery.data.data.slice(0, 15).map((n) => (
              <li key={n.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <p className="font-medium text-text">{n.title}</p>
                  <p className="text-sm text-text-secondary">{n.detail}</p>
                </div>
                <p className="text-xs text-text-secondary shrink-0">
                  {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
