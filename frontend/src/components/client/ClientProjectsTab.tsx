import { useState, useMemo, useCallback, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  getClientProjects,
  createClientProject,
  updateClientProject,
  deleteClientProject,
  type Project,
  type ProjectPayload,
} from '../../api/projects';
import { downloadProjectPdf } from '../../utils/projectPdf';
import { externalLinksFromProject } from '../../utils/externalLinksDisplay';
import { ExternalLinksList } from '../ExternalLinksList';
import { ProjectPdfPreviewModal } from '../ProjectPdfPreviewModal';

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
    const d = err.response.data as { error?: string; details?: { message?: string }[] };
    if (d.error === 'Validation failed' && Array.isArray(d.details) && d.details.length) {
      return d.details.map((x) => x.message ?? '').filter(Boolean).join('; ') || fallback;
    }
    if (typeof d.error === 'string' && d.error.trim()) return d.error;
  }
  return fallback;
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function parseCommaList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function milestonesFromDb(m: unknown): { title: string; dueDate: string }[] {
  if (!Array.isArray(m) || m.length === 0) return [{ title: '', dueDate: '' }];
  return m.map((x) => {
    const o = x as { title?: string; due_date?: string | null };
    return {
      title: String(o?.title ?? ''),
      dueDate: o?.due_date ? String(o.due_date).slice(0, 10) : '',
    };
  });
}

function buildMilestonePayload(rows: { title: string; dueDate: string }[]): ProjectPayload['milestones'] {
  const filtered = rows.filter((r) => r.title.trim());
  if (filtered.length === 0) return [];
  return filtered.map((r) => ({
    title: r.title.trim(),
    dueDate: r.dueDate ? r.dueDate : null,
  }));
}

type ExternalLinkRow = { url: string; description: string };

type FormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  externalLinks: ExternalLinkRow[];
  teamMembers: string;
  tags: string;
  budget: string;
  hours: string;
  hoursIsMaximum: boolean;
  dependencies: string;
  milestones: { title: string; dueDate: string }[];
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'not_started',
    priority: 'medium',
    externalLinks: [{ url: '', description: '' }],
    teamMembers: '',
    tags: '',
    budget: '',
    hours: '',
    hoursIsMaximum: false,
    dependencies: '',
    milestones: [{ title: '', dueDate: '' }],
    notes: '',
  };
}

function projectToForm(p: Project): FormState {
  let links: ExternalLinkRow[] = (p.external_links ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((l) => ({ url: l.url ?? '', description: l.description ?? '' }));
  if (links.length === 0 && p.external_link?.trim()) {
    links = [{ url: p.external_link, description: p.external_link_description ?? '' }];
  }
  if (links.length === 0) links = [{ url: '', description: '' }];
  return {
    name: p.name,
    description: p.description ?? '',
    startDate: p.start_date?.slice(0, 10) ?? '',
    endDate: p.end_date?.slice(0, 10) ?? '',
    status: p.status,
    priority: p.priority,
    externalLinks: links,
    teamMembers: (p.team_members ?? []).join(', '),
    tags: (p.tags ?? []).join(', '),
    budget: p.budget != null && p.budget !== '' ? String(p.budget) : '',
    hours: p.hours != null && p.hours !== '' ? String(p.hours) : '',
    hoursIsMaximum: Boolean(p.hours_is_maximum),
    dependencies: p.dependencies ?? '',
    milestones: milestonesFromDb(p.milestones),
    notes: p.notes ?? '',
  };
}

function formToPayload(f: FormState, requireName: boolean): ProjectPayload | null {
  if (requireName && !f.name.trim()) return null;
  const budgetNum = f.budget.trim() === '' ? null : Number(f.budget);
  if (f.budget.trim() !== '' && Number.isNaN(budgetNum)) return null;
  const hoursNum = f.hours.trim() === '' ? null : Number(f.hours);
  if (f.hours.trim() !== '' && Number.isNaN(hoursNum)) return null;
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
    status: f.status,
    priority: f.priority,
    externalLinks: f.externalLinks
      .filter((r) => r.url.trim())
      .map((r) => ({ url: r.url.trim(), description: r.description.trim() || null })),
    budget: budgetNum,
    hours: hoursNum,
    hoursIsMaximum: f.hoursIsMaximum,
    dependencies: f.dependencies.trim() || null,
    milestones: buildMilestonePayload(f.milestones),
    teamMembers: parseCommaList(f.teamMembers),
    tags: parseCommaList(f.tags),
    notes: f.notes.trim() || null,
  };
}

function ProjectFields({
  form,
  setForm,
  idPrefix,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  idPrefix: string;
}) {
  const setMilestone = (i: number, field: 'title' | 'dueDate', value: string) => {
    setForm((prev) => {
      const next = [...prev.milestones];
      next[i] = { ...next[i], [field]: value };
      return { ...prev, milestones: next };
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-text-secondary mb-1">
          Project name *
        </label>
        <input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full px-3 py-2 border border-input-border rounded-lg"
          required
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-desc`} className="block text-sm font-medium text-text-secondary mb-1">
          Description
        </label>
        <textarea
          id={`${idPrefix}-desc`}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-start`} className="block text-sm font-medium text-text-secondary mb-1">
          Start date
        </label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={form.startDate}
          onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-end`} className="block text-sm font-medium text-text-secondary mb-1">
          End date
        </label>
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={form.endDate}
          onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-status`} className="block text-sm font-medium text-text-secondary mb-1">
          Status
        </label>
        <select
          id={`${idPrefix}-status`}
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          className="w-full px-3 py-2 border border-input-border rounded-lg bg-surface"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-priority`} className="block text-sm font-medium text-text-secondary mb-1">
          Priority
        </label>
        <select
          id={`${idPrefix}-priority`}
          value={form.priority}
          onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
          className="w-full px-3 py-2 border border-input-border rounded-lg bg-surface"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-secondary">Documents</span>
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                externalLinks: [...prev.externalLinks, { url: '', description: '' }],
              }))
            }
            className="text-sm text-primary hover:underline"
          >
            + Add link
          </button>
        </div>
        {form.externalLinks.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 p-3 border border-border rounded-lg bg-surface-alt/80"
          >
            <div>
              <label
                htmlFor={`${idPrefix}-link-url-${idx}`}
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                URL
              </label>
              <input
                id={`${idPrefix}-link-url-${idx}`}
                type="url"
                value={row.url}
                onChange={(e) =>
                  setForm((prev) => {
                    const next = [...prev.externalLinks];
                    next[idx] = { ...next[idx], url: e.target.value };
                    return { ...prev, externalLinks: next };
                  })
                }
                placeholder="https://…"
                className="w-full px-3 py-2 border border-input-border rounded-lg"
              />
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-link-desc-${idx}`}
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Description
              </label>
              <input
                id={`${idPrefix}-link-desc-${idx}`}
                type="text"
                value={row.description}
                onChange={(e) =>
                  setForm((prev) => {
                    const next = [...prev.externalLinks];
                    next[idx] = { ...next[idx], description: e.target.value };
                    return { ...prev, externalLinks: next };
                  })
                }
                placeholder="e.g. SOW, requirements"
                className="w-full px-3 py-2 border border-input-border rounded-lg"
              />
            </div>
            <div className="flex items-end pb-0.5 md:justify-end">
              {form.externalLinks.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      externalLinks: prev.externalLinks.filter((_, j) => j !== idx),
                    }))
                  }
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              ) : (
                <span className="text-sm text-transparent select-none">—</span>
              )}
            </div>
          </div>
        ))}
        <p className="text-xs text-text-muted">
          Optional. Google Docs or Microsoft 365 share links — you control who can access each link.
        </p>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-team`} className="block text-sm font-medium text-text-secondary mb-1">
          Team members
        </label>
        <input
          id={`${idPrefix}-team`}
          value={form.teamMembers}
          onChange={(e) => setForm((p) => ({ ...p, teamMembers: e.target.value }))}
          placeholder="Comma-separated names or emails"
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-tags`} className="block text-sm font-medium text-text-secondary mb-1">
          Tags
        </label>
        <input
          id={`${idPrefix}-tags`}
          value={form.tags}
          onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
          placeholder="Comma-separated"
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-budget`} className="block text-sm font-medium text-text-secondary mb-1">
          Budget
        </label>
        <input
          id={`${idPrefix}-budget`}
          type="number"
          min={0}
          step="0.01"
          value={form.budget}
          onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
          className="w-full px-3 py-2 border border-input-border rounded-lg tabular-nums"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-hours`} className="block text-sm font-medium text-text-secondary mb-1">
          Hours
        </label>
        <input
          id={`${idPrefix}-hours`}
          type="number"
          min={0}
          step="0.25"
          value={form.hours}
          onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
          placeholder="e.g. 40"
          className="w-full px-3 py-2 border border-input-border rounded-lg tabular-nums"
        />
      </div>
      <div className="md:col-span-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.hoursIsMaximum}
            onChange={(e) => setForm((p) => ({ ...p, hoursIsMaximum: e.target.checked }))}
            className="mt-1 rounded border-input-border text-primary focus:ring-focus"
          />
          <span>
            <span className="block text-sm font-medium text-text-secondary">Hours value is a maximum (cap)</span>
            <span className="block text-xs text-text-muted mt-0.5">
              When unchecked, the hours field is an estimate or planned amount, not a cap.
            </span>
          </span>
        </label>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-deps`} className="block text-sm font-medium text-text-secondary mb-1">
          Dependencies
        </label>
        <textarea
          id={`${idPrefix}-deps`}
          value={form.dependencies}
          onChange={(e) => setForm((p) => ({ ...p, dependencies: e.target.value }))}
          rows={2}
          placeholder="Other projects or deliverables this work depends on"
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
      <div className="md:col-span-2">
        <span className="block text-sm font-medium text-text-secondary mb-2">Milestones</span>
        <div className="space-y-2">
          {form.milestones.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="sr-only" htmlFor={`${idPrefix}-ms-title-${i}`}>
                  Milestone title
                </label>
                <input
                  id={`${idPrefix}-ms-title-${i}`}
                  value={row.title}
                  onChange={(e) => setMilestone(i, 'title', e.target.value)}
                  placeholder="Milestone title"
                  className="w-full px-3 py-2 border border-input-border rounded-lg text-sm"
                />
              </div>
              <div className="w-40">
                <label className="sr-only" htmlFor={`${idPrefix}-ms-date-${i}`}>
                  Due date
                </label>
                <input
                  id={`${idPrefix}-ms-date-${i}`}
                  type="date"
                  value={row.dueDate}
                  onChange={(e) => setMilestone(i, 'dueDate', e.target.value)}
                  className="w-full px-3 py-2 border border-input-border rounded-lg text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    milestones: prev.milestones.filter((_, j) => j !== i),
                  }))
                }
                disabled={form.milestones.length <= 1}
                className="px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              milestones: [...prev.milestones, { title: '', dueDate: '' }],
            }))
          }
          className="mt-2 text-sm text-primary hover:underline"
        >
          + Add milestone
        </button>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-notes`} className="block text-sm font-medium text-text-secondary mb-1">
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-input-border rounded-lg"
        />
      </div>
    </div>
  );
}

export function ClientProjectsTab({
  clientId,
  clientLabel,
}: {
  clientId: string;
  /** Shown in PDF header (e.g. from `formatClientLabel`) */
  clientLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [pdfPreviewProject, setPdfPreviewProject] = useState<Project | null>(null);

  const projectsQuery = useQuery({
    queryKey: ['client-projects', clientId],
    queryFn: () => getClientProjects(clientId),
  });

  const createMut = useMutation({
    mutationFn: (payload: ProjectPayload) => createClientProject(clientId, payload),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['client-projects', clientId] });
      toast.success('Project created');
      setShowNew(false);
      setNewForm(emptyForm());
      try {
        downloadProjectPdf(project, clientLabel);
      } catch {
        toast.error('Project saved, but PDF could not be generated');
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create project')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectPayload> }) =>
      updateClientProject(clientId, id, payload),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['client-projects', clientId] });
      toast.success('Project saved');
      setEditingId(null);
      setEditForm(null);
      try {
        downloadProjectPdf(project, clientLabel);
      } catch {
        toast.error('Project saved, but PDF could not be generated');
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save project')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClientProject(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects', clientId] });
      toast.success('Project deleted');
      setEditingId(null);
      setEditForm(null);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not delete project')),
  });

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditForm(projectToForm(p));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const submitNew = (e: FormEvent) => {
    e.preventDefault();
    const payload = formToPayload(newForm, true);
    if (!payload) {
      toast.error('Check project name, budget, and hours');
      return;
    }
    createMut.mutate(payload);
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editForm || !editingId) return;
    const payload = formToPayload(editForm, true);
    if (!payload) {
      toast.error('Check project name, budget, and hours');
      return;
    }
    updateMut.mutate({ id: editingId, payload });
  };

  const projects = projectsQuery.data ?? [];

  const sorted = useMemo(
    () => [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [projects]
  );

  const setEditFormSafe = useCallback((action: SetStateAction<FormState>) => {
    setEditForm((prev) => {
      if (prev === null) return null;
      return typeof action === 'function' ? action(prev) : action;
    });
  }, []);

  return (
    <section id="projects" className="space-y-8">
      <ProjectPdfPreviewModal
        open={pdfPreviewProject !== null}
        onClose={() => setPdfPreviewProject(null)}
        project={pdfPreviewProject}
        clientLabel={clientLabel}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Projects</h2>
          <p className="text-sm text-text-secondary mt-1">Track work for this client: dates, team, budget, hours, and links.</p>
        </div>
        {!showNew && (
          <button
            type="button"
            onClick={() => {
              setShowNew(true);
              setNewForm(emptyForm());
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover text-sm font-medium"
          >
            Add project
          </button>
        )}
      </div>

      {projectsQuery.isPending && <p className="text-text-faint">Loading projects…</p>}
      {projectsQuery.isError && <p className="text-red-600">Could not load projects.</p>}

      {showNew && (
        <form onSubmit={submitNew} className="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-4">
          <h3 className="text-base font-semibold text-text">New project</h3>
          <ProjectFields form={newForm} setForm={setNewForm} idPrefix="new" />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowNew(false);
                setNewForm(emptyForm());
              }}
              className="px-4 py-2 border border-input-border rounded-lg hover:bg-surface-alt text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
            >
              {createMut.isPending ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 && !projectsQuery.isPending && !showNew && (
        <p className="text-text-muted py-6 text-center border border-dashed border-border rounded-xl">
          No projects yet. Add one to get started.
        </p>
      )}

      {sorted.map((p) => (
        <div key={p.id} className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
          {editingId === p.id && editForm ? (
            <form onSubmit={submitEdit} className="p-6 space-y-4">
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <h3 className="text-base font-semibold text-text">Edit project</h3>
                <button type="button" onClick={cancelEdit} className="text-sm text-text-secondary hover:underline">
                  Cancel
                </button>
              </div>
              <ProjectFields form={editForm} setForm={setEditFormSafe} idPrefix={`edit-${p.id}`} />
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this project?')) deleteMut.mutate(p.id);
                  }}
                  disabled={deleteMut.isPending}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={updateMut.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
                >
                  {updateMut.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6">
              {/* Header: title + actions */}
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-text">{p.name}</h3>
                  {p.description && p.description !== '—' && (
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPdfPreviewProject(p)}
                    className="px-3 py-1.5 border border-input-border rounded-lg hover:bg-surface-alt text-sm"
                  >
                    View
                  </button>
                  <Link
                    to={`/invoices/new?clientId=${encodeURIComponent(clientId)}&projectId=${encodeURIComponent(p.id)}`}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Create
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        downloadProjectPdf(p, clientLabel);
                      } catch {
                        toast.error('Could not download PDF');
                      }
                    }}
                    className="px-3 py-1.5 border border-input-border rounded-lg hover:bg-surface-alt text-sm"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="px-3 py-1.5 border border-input-border rounded-lg hover:bg-surface-alt text-sm"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Metadata grid */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 rounded-lg bg-surface-alt border border-border px-4 py-3">
                <div>
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">Status</dt>
                  <dd className="mt-0.5 text-sm font-medium text-text capitalize">{p.status.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">Priority</dt>
                  <dd className="mt-0.5 text-sm font-medium text-text capitalize">{p.priority}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">Start</dt>
                  <dd className="mt-0.5 text-sm text-text tabular-nums">{p.start_date?.slice(0, 10) ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">End</dt>
                  <dd className="mt-0.5 text-sm text-text tabular-nums">{p.end_date?.slice(0, 10) ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">Hours</dt>
                  <dd className="mt-0.5 text-sm text-text tabular-nums">
                    {p.hours != null && p.hours !== ''
                      ? `${Number(p.hours).toLocaleString(undefined, { maximumFractionDigits: 2 })}${
                          p.hours_is_maximum ? ' max' : ''
                        }`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">Documents</dt>
                  <dd className="mt-0.5 text-sm">
                    {externalLinksFromProject(p).length > 0 ? (
                      <ExternalLinksList
                        links={externalLinksFromProject(p)}
                        className="text-sm space-y-0.5 list-none pl-0"
                      />
                    ) : (
                      <span className="text-text">—</span>
                    )}
                  </dd>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
