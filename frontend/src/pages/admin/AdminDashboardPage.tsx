import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAdminDashboard, getUserGrowth } from '../../api/admin';

export function AdminDashboardPage() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminDashboard });
  const { data: growth } = useQuery({ queryKey: ['admin-user-growth'], queryFn: () => getUserGrowth(30) });

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

      <div className="bg-white rounded-lg shadow p-6">
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
    </div>
  );
}
