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
    return <p className="text-gray-600">Loading your dashboard…</p>;
  }
  if (meQuery.isError || !meQuery.data) {
    return <p className="text-red-600">Could not load dashboard.</p>;
  }

  const { client, vendor, stats } = meQuery.data;
  const clientDisplayName = client.company?.trim() || client.name;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {clientDisplayName}</h1>
        <p className="text-gray-700 mt-1">
          {vendor.businessName ? `${vendor.businessName} · ` : ''}
          Account overview and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-sky-100 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Open invoices</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-sky-700">{stats.openInvoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Outstanding balance</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-purple-700">
            {money(stats.outstandingTotal)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-sky-100 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Visible invoices</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-gray-900">{stats.visibleInvoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-300 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Projects</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-gray-900">{stats.projectCount}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent activity</h2>
        <p className="text-sm text-gray-600 mb-3">
          Updates refresh about every minute while this page is open.
        </p>
        {notifQuery.isPending && <p className="text-gray-500">Loading activity…</p>}
        {notifQuery.isError && <p className="text-red-600">Could not load activity.</p>}
        {notifQuery.data && notifQuery.data.data.length === 0 && (
          <p className="text-gray-600 py-4">No recent invoice or project updates.</p>
        )}
        {notifQuery.data && notifQuery.data.data.length > 0 && (
          <ul className="bg-white rounded-xl border border-sky-100 divide-y divide-sky-50 shadow-sm">
            {notifQuery.data.data.slice(0, 15).map((n) => (
              <li key={n.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <p className="font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-700">{n.detail}</p>
                </div>
                <p className="text-xs text-gray-600 shrink-0">
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
