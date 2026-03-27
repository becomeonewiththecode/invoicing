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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Content Moderation</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'pending' && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-indigo-50 rounded-lg px-4 py-3">
          <span className="text-sm text-indigo-700">{selected.size} selected</span>
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {activeTab === 'pending' && (
                <th className="px-6 py-3 w-10">
                  <input type="checkbox" onChange={toggleAll} checked={data?.data.length ? selected.size === data.data.length : false} />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              {activeTab === 'pending' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isPending && (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            )}
            {data?.data.map((flag) => (
              <tr key={flag.id} className="hover:bg-gray-50">
                {activeTab === 'pending' && (
                  <td className="px-6 py-4">
                    <input type="checkbox" checked={selected.has(flag.id)} onChange={() => toggleSelect(flag.id)} />
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-gray-700">{flag.user_email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs">{flag.content_type}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{flag.content_snippet}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{flag.reason || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(flag.created_at).toLocaleDateString()}</td>
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
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No flags found</td></tr>
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
