import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAdminDashboard, getUserGrowth, getHealthStatus, getSystemLogs } from '../../api/admin';

const statusIcon: Record<string, { color: string; label: string }> = {
  healthy: { color: 'bg-green-500', label: 'Healthy' },
  degraded: { color: 'bg-yellow-500', label: 'Degraded' },
  unhealthy: { color: 'bg-red-500', label: 'Unhealthy' },
};

export function AdminDashboardPage() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminDashboard });
  const { data: growth } = useQuery({ queryKey: ['admin-user-growth'], queryFn: () => getUserGrowth(30) });

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logLevel, setLogLevel] = useState<string>('');

  const { data: health } = useQuery({
    queryKey: ['admin-health'],
    queryFn: getHealthStatus,
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const { data: logs } = useQuery({
    queryKey: ['admin-logs', logPage, logLevel],
    queryFn: () => getSystemLogs(logPage, 20, { level: logLevel || undefined }),
  });

  const metrics = [
    { label: 'Total Users', value: stats?.totalUsers ?? '-', color: 'text-blue-600' },
    { label: 'Active Users (30d)', value: stats?.activeUsers ?? '-', color: 'text-green-600' },
    { label: 'Open Tickets', value: stats?.openTickets ?? '-', color: 'text-orange-600' },
    { label: 'Pending Moderation', value: stats?.pendingFlags ?? '-', color: 'text-red-600' },
    { label: 'Total Invoices', value: stats?.totalInvoices ?? '-', color: 'text-indigo-600' },
    {
      label: 'Platform Revenue',
      value: stats ? `$${Number(stats.platformRevenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-',
      color: 'text-emerald-600',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">User Growth (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={growth || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* System Health */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-gray-300"
          />
          Auto-refresh (30s)
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {health?.services.map((svc) => {
          const icon = statusIcon[svc.status] || statusIcon.unhealthy;
          return (
            <div key={svc.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className={`inline-block w-3 h-3 rounded-full ${icon.color}`} />
                <h3 className="font-semibold text-gray-900 capitalize">{svc.name}</h3>
              </div>
              <p className="text-sm text-gray-500">{icon.label} &middot; {svc.responseTimeMs}ms</p>
              {svc.message && <p className="text-xs text-red-500 mt-1 truncate">{svc.message}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Error Rate</p>
          <p className="text-2xl font-bold text-red-600">{health?.errorRate ?? '-'}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Avg Response Time</p>
          <p className="text-2xl font-bold text-blue-600">{health?.avgResponseTime ?? '-'}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Requests (Last Hour)</p>
          <p className="text-2xl font-bold text-indigo-600">{health?.requestsLastHour ?? '-'}</p>
        </div>
      </div>

      {/* System Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">System Logs</h2>
          <select
            value={logLevel}
            onChange={(e) => { setLogLevel(e.target.value); setLogPage(1); }}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time (ms)</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs?.data.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.level === 'error' ? 'bg-red-100 text-red-700' :
                      log.level === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{log.level}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{log.method || '-'}</td>
                  <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{log.path || '-'}</td>
                  <td className="px-4 py-2 text-gray-700">{log.status_code || '-'}</td>
                  <td className="px-4 py-2 text-gray-700">{log.response_time_ms ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{log.ip || '-'}</td>
                </tr>
              ))}
              {logs && logs.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {logs && logs.pagination.total > logs.pagination.limit && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 mt-2">
            <p className="text-sm text-gray-500">Page {logPage} of {Math.ceil(logs.pagination.total / logs.pagination.limit)}</p>
            <div className="flex gap-2">
              <button disabled={logPage <= 1} onClick={() => setLogPage(logPage - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
              <button disabled={logPage >= Math.ceil(logs.pagination.total / logs.pagination.limit)} onClick={() => setLogPage(logPage + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
