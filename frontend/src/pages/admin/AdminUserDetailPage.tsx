import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getAdminUserDetail, updateUserRole, flagUserContent, deleteUser } from '../../api/admin';

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [flagForm, setFlagForm] = useState({ contentType: '', contentSnippet: '', reason: '' });
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: user, isPending } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUserDetail(id!),
    enabled: !!id,
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) => updateUserRole(id!, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const flagMutation = useMutation({
    mutationFn: () => flagUserContent(id!, flagForm),
    onSuccess: () => {
      toast.success('Content flagged');
      setShowFlagForm(false);
      setFlagForm({ contentType: '', contentSnippet: '', reason: '' });
    },
    onError: () => toast.error('Failed to flag content'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deleted');
      navigate('/admin/users');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to delete user');
    },
  });

  if (isPending) return <div className="text-gray-500">Loading...</div>;
  if (!user) return <div className="text-gray-500">User not found</div>;

  return (
    <div>
      <Link to="/admin/users" className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
        &larr; Back to Users
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{user.email}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">User Info</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Business</dt>
              <dd className="text-gray-900">{user.business_name || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{user.business_phone || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Website</dt>
              <dd className="text-gray-900">{user.business_website || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Clients</dt>
              <dd className="text-gray-900">{user.client_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Invoices</dt>
              <dd className="text-gray-900">{user.invoice_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Revenue</dt>
              <dd className="text-gray-900">${Number(user.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Joined</dt>
              <dd className="text-gray-900">{new Date(user.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Role Management</h2>
          <div className="flex items-center gap-4">
            <select
              value={user.role}
              onChange={(e) => roleMutation.mutate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {user.role}
            </span>
          </div>

          <div className="mt-6">
            <button
              onClick={() => setShowFlagForm(!showFlagForm)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Flag Content for Review
            </button>

            {showFlagForm && (
              <div className="mt-3 space-y-3">
                <select
                  value={flagForm.contentType}
                  onChange={(e) => setFlagForm({ ...flagForm, contentType: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select content type...</option>
                  <option value="business_name">Business Name</option>
                  <option value="invoice_notes">Invoice Notes</option>
                  <option value="client_notes">Client Notes</option>
                </select>
                <textarea
                  placeholder="Content snippet..."
                  value={flagForm.contentSnippet}
                  onChange={(e) => setFlagForm({ ...flagForm, contentSnippet: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <input
                  placeholder="Reason (optional)"
                  value={flagForm.reason}
                  onChange={(e) => setFlagForm({ ...flagForm, reason: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => flagMutation.mutate()}
                  disabled={!flagForm.contentType || !flagForm.contentSnippet}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Submit Flag
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-lg shadow p-6 border border-red-200">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Danger zone</h2>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete this user and all associated data: clients, invoices, discount codes, tickets, backups, and content flags. This action cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Delete user
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Type <strong>{user.email}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder={user.email}
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteConfirmText !== user.email || deleteMutation.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Permanently delete'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
