import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getRevenueStats } from '../api/invoices';
import { getInvoices } from '../api/invoices';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatInvoiceClientLabel } from '../utils/clientDisplay';

export function DashboardPage() {
  const { data: stats } = useQuery({ queryKey: ['revenue-stats'], queryFn: getRevenueStats });
  const { data: recentInvoices } = useQuery({
    queryKey: ['invoices', 1],
    queryFn: () => getInvoices(1, 5),
  });

  const chartData = stats
    ? [
        { name: 'Revenue', value: Number(stats.total_revenue) },
        { name: 'Pending', value: Number(stats.pending_amount) },
        { name: 'Late', value: Number(stats.late_amount) },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 md:items-stretch">
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col min-h-[8.5rem]">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600 tabular-nums mt-2 flex-1 flex items-center">
            ${Number(stats?.total_revenue || 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-auto pt-1">{stats?.paid_count || 0} paid invoices</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col min-h-[8.5rem]">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-3xl font-bold text-blue-600 tabular-nums mt-2 flex-1 flex items-center">
            ${Number(stats?.pending_amount || 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-auto pt-1">{stats?.pending_count || 0} invoices</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col min-h-[8.5rem]">
          <p className="text-sm text-gray-500">Late</p>
          <p className="text-3xl font-bold text-red-600 tabular-nums mt-2 flex-1 flex items-center">
            ${Number(stats?.late_amount || 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-auto pt-1">{stats?.late_count || 0} invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Overview</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent invoices */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Invoices</h2>
            <Link to="/invoices" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentInvoices?.data.map((invoice) => (
              <Link
                key={invoice.id}
                to={`/invoices/${invoice.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <p className="text-sm text-gray-500">{formatInvoiceClientLabel(invoice)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${Number(invoice.total).toFixed(2)}</p>
                  <StatusBadge status={invoice.status} />
                </div>
              </Link>
            ))}
            {(!recentInvoices?.data || recentInvoices.data.length === 0) && (
              <p className="text-gray-400 text-center py-4">No invoices yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
