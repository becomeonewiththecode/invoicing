import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getPortalProject } from '../../api/portal';
import { ExternalLinksList } from '../../components/ExternalLinksList';
import { externalLinksFromProject } from '../../utils/externalLinksDisplay';

function statusLabel(status: string): string {
  const s = status?.trim();
  const map: Record<string, string> = {
    not_started: 'Not started',
    planning: 'Planning',
    in_progress: 'In progress',
    on_hold: 'On hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[s] ?? s ?? '—';
}

function formatDate(d: string | null | undefined) {
  const s = d ?? '';
  if (!s) return '—';
  // Stored as YYYY-MM-DD
  return String(s).slice(0, 10);
}

function money(s: string | null | undefined) {
  const n = Number(s ?? 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PortalProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const q = useQuery({
    queryKey: ['portal-project', projectId],
    queryFn: () => getPortalProject(projectId!),
    enabled: !!projectId,
  });

  if (!projectId) {
    return <p className="text-gray-600 py-6">Missing project.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link to="/portal/projects" className="text-sm text-sky-700 hover:text-purple-800 hover:underline">
            &larr; Back to projects
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {q.data?.name ?? 'Project'}
          </h1>
          <p className="text-sm text-gray-700 mt-1">
            Status: <span className="font-medium text-gray-900">{q.data ? statusLabel(q.data.status) : '—'}</span>
          </p>
        </div>
      </div>

      {q.isPending && <p className="text-gray-500">Loading project…</p>}
      {q.isError && <p className="text-red-600">Could not load project.</p>}

      {q.data && (
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-6 space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
            {q.data.description && q.data.description.trim() ? (
              <p className="text-gray-800 whitespace-pre-wrap">{q.data.description}</p>
            ) : (
              <p className="text-gray-600 text-sm">No description.</p>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mt-4">
              <div>
                <dt className="text-gray-600">Priority</dt>
                <dd className="text-gray-900 font-medium capitalize">{q.data.priority ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Budget</dt>
                <dd className="text-gray-900 font-medium">{q.data.budget != null ? money(String(q.data.budget)) : '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Start date</dt>
                <dd className="text-gray-900 font-medium">{formatDate(q.data.start_date)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">End date</dt>
                <dd className="text-gray-900 font-medium">{formatDate(q.data.end_date)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Details</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <dt className="text-gray-600 text-sm font-medium">Dependencies</dt>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">
                  {q.data.dependencies?.trim() ? q.data.dependencies : '—'}
                </p>

                <dt className="text-gray-600 text-sm font-medium mt-4">Team members</dt>
                <p className="text-gray-900 mt-1">
                  {q.data.team_members && q.data.team_members.length ? q.data.team_members.join(', ') : '—'}
                </p>

                <dt className="text-gray-600 text-sm font-medium mt-4">Tags</dt>
                <p className="text-gray-900 mt-1">
                  {q.data.tags && q.data.tags.length ? q.data.tags.join(', ') : '—'}
                </p>

                <dt className="text-gray-600 text-sm font-medium mt-4">Notes</dt>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">
                  {q.data.notes?.trim() ? q.data.notes : '—'}
                </p>
              </div>

              <div>
                <dt className="text-gray-600 text-sm font-medium">Milestones</dt>
                <ul className="mt-2 space-y-2 text-sm">
                  {Array.isArray(q.data.milestones) && q.data.milestones.length > 0
                    ? (q.data.milestones as any[]).map((m, idx) => (
                        <li
                          key={`${idx}-${m?.title ?? ''}`}
                          className="bg-gray-100 border border-gray-200 rounded-lg p-3"
                        >
                          <p className="font-medium text-gray-900">
                            {String(m?.title ?? '') || 'Milestone'}
                          </p>
                          <p className="text-gray-700 mt-1">
                            {m?.due_date ? formatDate(m.due_date) : 'No due date'}
                          </p>
                        </li>
                      ))
                    : (
                        <li className="text-gray-600">No milestones.</li>
                      )}
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Documents & links</h2>

            <ExternalLinksList links={externalLinksFromProject(q.data)} />
          </section>
        </div>
      )}
    </div>
  );
}

