import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getModerationQueue, reviewFlag, bulkReviewFlags } from '../../api/admin';

const tabs = ['pending', 'approved', 'rejected'] as const;

export function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['admin-moderation', activeTab, page],
    queryFn: () => getModerationQueue(activeTab, page, 20),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) => reviewFlag(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderation'] });
      toast.success('Flag reviewed');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => bulkReviewFlags(Array.from(selected), decision),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderation'] });
      setSelected(new Set());
      toast.success(`${data.updated} flags reviewed`);
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.data.map((f) => f.id)));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Content Moderation</h1>

      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary hover:border-input-border'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'pending' && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-primary-light rounded-lg px-4 py-3">
          <span className="text-sm text-primary">{selected.size} selected</span>
          <button
            onClick={() => bulkMutation.mutate('approved')}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
          >
            Approve Selected
          </button>
          <button
            onClick={() => bulkMutation.mutate('rejected')}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Reject Selected
          </button>
        </div>
      )}

      <div className="bg-surface rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-alt">
            <tr>
              {activeTab === 'pending' && (
                <th className="px-6 py-3 w-10">
                  <input type="checkbox" onChange={toggleAll} checked={data?.data.length ? selected.size === data.data.length : false} />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Content</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Date</th>
              {activeTab === 'pending' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending && (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-text-muted">Loading...</td></tr>
            )}
            {data?.data.map((flag) => (
              <tr key={flag.id} className="hover:bg-surface-alt">
                {activeTab === 'pending' && (
                  <td className="px-6 py-4">
                    <input type="checkbox" checked={selected.has(flag.id)} onChange={() => toggleSelect(flag.id)} />
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-text-secondary">{flag.user_email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-flex rounded-full bg-surface-alt px-2 py-0.5 text-xs">{flag.content_type}</span>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary max-w-xs truncate">{flag.content_snippet}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{flag.reason || '-'}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{new Date(flag.created_at).toLocaleDateString()}</td>
                {activeTab === 'pending' && (
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewMutation.mutate({ id: flag.id, decision: 'approved' })}
                        className="text-green-600 hover:text-green-800"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: flag.id, decision: 'rejected' })}
                        className="text-red-600 hover:text-red-800"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-text-muted">No flags found</td></tr>
            )}
          </tbody>
        </table>

        {data && data.pagination.total > data.pagination.limit && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-sm text-text-muted">Page {page} of {Math.ceil(data.pagination.total / data.pagination.limit)}</p>
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
