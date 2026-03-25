import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getBackups,
  triggerBackup,
  restoreBackup,
  verifyBackup,
  deleteBackup,
  getBackupPolicies,
  updateBackupPolicy,
  getAdminUsers,
} from '../../api/admin';

export function AdminBackupsPage() {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'policies'>('snapshots');
  const [page, setPage] = useState(1);
  const [triggerUserId, setTriggerUserId] = useState('');
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => getAdminUsers(1, 100),
  });

  const { data: snapshots } = useQuery({
    queryKey: ['admin-backups', page],
    queryFn: () => getBackups(page, 20),
    enabled: activeTab === 'snapshots',
  });

  const { data: policies } = useQuery({
    queryKey: ['admin-backup-policies'],
    queryFn: getBackupPolicies,
    enabled: activeTab === 'policies',
  });

  const triggerMutation = useMutation({
    mutationFn: (userId: string) => triggerBackup(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      setTriggerUserId('');
      toast.success('Backup created');
    },
    onError: () => toast.error('Failed to create backup'),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: () => toast.success('Backup restored'),
    onError: () => toast.error('Failed to restore backup'),
  });

  const verifyMutation = useMutation({
    mutationFn: verifyBackup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      toast.success(data.verified ? 'Backup verified' : 'Backup verification failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      toast.success('Backup deleted');
    },
  });

  const policyMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) => updateBackupPolicy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backup-policies'] });
      toast.success('Policy updated');
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Backup Management</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['snapshots', 'policies'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'snapshots' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <select
              value={triggerUserId}
              onChange={(e) => setTriggerUserId(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a user...</option>
              {users?.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}{u.business_name ? ` (${u.business_name})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => triggerMutation.mutate(triggerUserId)}
              disabled={!triggerUserId || triggerMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Trigger Backup
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {snapshots?.data.map((snap) => (
                  <tr key={snap.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">{snap.user_email || snap.user_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(snap.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{(snap.file_size_bytes / 1024).toFixed(1)} KB</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        snap.is_automated ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>{snap.is_automated ? 'Auto' : 'Manual'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        snap.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{snap.verified ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (confirm('Restore this backup? This will replace the user\'s current data.')) {
                              restoreMutation.mutate(snap.id);
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => verifyMutation.mutate(snap.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this backup snapshot?')) {
                              deleteMutation.mutate(snap.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {snapshots && snapshots.data.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No backups found</td></tr>
                )}
              </tbody>
            </table>

            {snapshots && snapshots.pagination.total > snapshots.pagination.limit && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
                <p className="text-sm text-gray-500">Page {page} of {Math.ceil(snapshots.pagination.total / snapshots.pagination.limit)}</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
                  <button disabled={page >= Math.ceil(snapshots.pagination.total / snapshots.pagination.limit)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'policies' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retention (days)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Snapshots</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {policies?.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">{policy.user_email || 'Global Default'}</td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="number"
                      defaultValue={policy.retention_days}
                      onBlur={(e) => policyMutation.mutate({ id: policy.id, retention_days: Number(e.target.value) })}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="number"
                      defaultValue={policy.max_snapshots}
                      onBlur={(e) => policyMutation.mutate({ id: policy.id, max_snapshots: Number(e.target.value) })}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="text"
                      defaultValue={policy.cron_expression}
                      onBlur={(e) => policyMutation.mutate({ id: policy.id, cron_expression: e.target.value })}
                      className="w-32 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="checkbox"
                      defaultChecked={policy.is_enabled}
                      onChange={(e) => policyMutation.mutate({ id: policy.id, is_enabled: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                  </td>
                </tr>
              ))}
              {policies && policies.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No policies configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
