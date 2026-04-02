import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAdminUsers } from '../../api/admin';

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => getAdminUsers(page, 20, search || undefined),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Users</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email or business name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md rounded-lg border border-input-border px-4 py-2 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
        />
      </div>

      <div className="bg-surface rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-alt">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Business</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Invoices</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending && (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-text-muted">Loading...</td></tr>
            )}
            {data?.data.map((user) => (
              <tr key={user.id} className="hover:bg-surface-alt">
                <td className="px-6 py-4 text-sm">
                  <Link to={`/admin/users/${user.id}`} className="text-primary hover:text-primary-hover">
                    {user.email}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary">{user.business_name || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.role === 'admin' ? 'bg-primary-light text-primary' : 'bg-surface-alt text-text-secondary'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary">{user.invoice_count}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-text-muted">No users found</td></tr>
            )}
          </tbody>
        </table>

        {data && data.pagination.total > data.pagination.limit && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-sm text-text-muted">
              Page {data.pagination.page} of {Math.ceil(data.pagination.total / data.pagination.limit)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.ceil(data.pagination.total / data.pagination.limit)}
                onClick={() => setPage(page + 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
