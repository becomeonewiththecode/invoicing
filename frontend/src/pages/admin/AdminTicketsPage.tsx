import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAdminTickets } from '../../api/admin';

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-700',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export function AdminTicketsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['admin-tickets', page, status, priority, search],
    queryFn: () =>
      getAdminTickets(page, 20, {
        status: status || undefined,
        priority: priority || undefined,
        search: search || undefined,
      }),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Support Tickets</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isPending && (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            )}
            {data?.data.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">
                  <Link to={`/admin/tickets/${ticket.id}`} className="text-indigo-600 hover:text-indigo-800">
                    {ticket.subject}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{ticket.user_email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status] || ''}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[ticket.priority] || ''}`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(ticket.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No tickets found</td></tr>
            )}
          </tbody>
        </table>

        {data && data.pagination.total > data.pagination.limit && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <p className="text-sm text-gray-500">Page {page} of {Math.ceil(data.pagination.total / data.pagination.limit)}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
              <button disabled={page >= Math.ceil(data.pagination.total / data.pagination.limit)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
