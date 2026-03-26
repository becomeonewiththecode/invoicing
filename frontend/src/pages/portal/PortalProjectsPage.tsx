import { useQuery } from '@tanstack/react-query';
import { getPortalProjects } from '../../api/portal';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  planning: 'Planning',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function PortalProjectsPage() {
  const q = useQuery({
    queryKey: ['portal-projects'],
    queryFn: getPortalProjects,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-gray-600 mt-1 text-sm">Work your vendor tracks for your account.</p>
      </div>

      {q.isPending && <p className="text-gray-400">Loading projects…</p>}
      {q.isError && <p className="text-red-600">Could not load projects.</p>}
      {q.data && q.data.data.length === 0 && (
        <p className="text-gray-500 py-6">No projects yet.</p>
      )}
      {q.data && q.data.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data.data.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <h2 className="font-semibold text-gray-900">{p.name}</h2>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Status</dt>
                  <dd className="text-gray-900">{STATUS_LABEL[p.status] ?? p.status}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Priority</dt>
                  <dd className="text-gray-900 capitalize">{p.priority}</dd>
                </div>
                {p.end_date && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Target end</dt>
                    <dd className="text-gray-900">{p.end_date.slice(0, 10)}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
