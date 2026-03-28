import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import axios from 'axios';
import { createInvoice, updateInvoice, getInvoice, getInvoices, type InvoicePayload } from '../api/invoices';
import { getDiscounts } from '../api/discounts';
import { getClients } from '../api/clients';
import { getSettings } from '../api/settings';
import { getClientProjects } from '../api/projects';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { buildInvoiceFromForm, projectExternalLinksFromProject } from '../utils/invoicePreview';
import type { Invoice } from '../types';
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { formatClientLabel } from '../utils/clientDisplay';

/** Sum of hours on lines that have a non-empty description (matches what is invoiced). */
function sumBilledHours(formItems: { description: string; hours: number }[]): number {
  return formItems.reduce((sum, row) => {
    if (!row.description?.trim()) return sum;
    const h = Number(row.hours);
    return sum + (Number.isFinite(h) ? Math.max(0, h) : 0);
  }, 0);
}

interface InvoiceFormData {
  clientId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  isRecurring: boolean;
  recurrenceInterval: string;
  items: { description: string; hours: number }[];
}

export function NewInvoicePage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('clientId') || '';
  const preselectedProjectId = searchParams.get('projectId') || '';
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 1, 100],
    queryFn: () => getClients(1, 100),
  });

  const {
    data: existingInvoice,
    isPending: invoiceLoading,
    isError: invoiceError,
  } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id!),
    enabled: isEdit,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data: discounts } = useQuery({
    queryKey: ['discounts'],
    queryFn: getDiscounts,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<InvoiceFormData>({
    defaultValues: {
      clientId: preselectedClientId,
      projectId: preselectedProjectId,
      issueDate: today,
      dueDate: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
      isRecurring: false,
      items: [{ description: '', hours: 1 }],
    },
  });

  useEffect(() => {
    if (!isEdit && preselectedClientId && clientsData?.data.some((c) => c.id === preselectedClientId)) {
      setValue('clientId', preselectedClientId);
    }
  }, [isEdit, preselectedClientId, clientsData, setValue]);

  useEffect(() => {
    if (!isEdit || !existingInvoice) return;
    const lineItems = existingInvoice.items?.length
      ? existingInvoice.items.map((item) => ({
          description: item.description,
          hours: Number(item.quantity) || 1,
        }))
      : [{ description: '', hours: 1 }];

    reset({
      clientId: existingInvoice.client_id,
      projectId: existingInvoice.project_id ?? '',
      issueDate: existingInvoice.issue_date.slice(0, 10),
      dueDate: existingInvoice.due_date.slice(0, 10),
      notes: existingInvoice.notes ?? '',
      isRecurring: existingInvoice.is_recurring,
      recurrenceInterval: existingInvoice.recurrence_interval || 'monthly',
      items: lineItems,
    });
  }, [isEdit, existingInvoice, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const clientId = watch('clientId');
  const projectId = watch('projectId');
  const prevClientIdRef = useRef<string | null>(null);
  /** Tracks last project id for syncing line hours when the user picks a project (skipped on edit load). */
  const prevProjectIdForSyncRef = useRef<string>('');

  const { data: clientProjects = [] } = useQuery({
    queryKey: ['client-projects', clientId],
    queryFn: () => getClientProjects(clientId),
    enabled: Boolean(clientId),
  });

  /** Derive conflicts from the invoice list for this client (same fields as GET /invoices). Avoids relying on
   *  GET /for-project only — if that route is missing or errors, the list API still drives the amber alert. */
  const {
    data: clientInvoicesForConflict,
    isPending: conflictCheckLoading,
    isError: conflictCheckError,
  } = useQuery({
    queryKey: ['invoices', 'conflict-check', clientId],
    queryFn: () => getInvoices(1, 100, clientId),
    enabled: Boolean(clientId?.trim()) && Boolean(projectId?.trim()),
  });

  const projectInvoiceConflicts = useMemo(() => {
    const rows = clientInvoicesForConflict?.data;
    if (!projectId?.trim() || !rows?.length) return [];
    const pid = projectId.trim();
    return rows
      .filter(
        (inv) =>
          inv.project_id != null &&
          String(inv.project_id) === pid &&
          inv.status !== 'cancelled' &&
          (!isEdit || !id || inv.id !== id)
      )
      .map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: String(inv.status),
      }));
  }, [clientInvoicesForConflict, projectId, isEdit, id]);

  const hasProjectInvoiceConflict = projectInvoiceConflicts.length > 0;
  const conflictCheckPending =
    Boolean(clientId?.trim()) && Boolean(projectId?.trim()) && conflictCheckLoading;
  const blockProjectActions = hasProjectInvoiceConflict || conflictCheckPending;

  useEffect(() => {
    if (prevClientIdRef.current !== null && prevClientIdRef.current !== clientId) {
      setValue('projectId', '');
    }
    prevClientIdRef.current = clientId;
  }, [clientId, setValue]);

  useEffect(() => {
    if (isEdit && existingInvoice) {
      prevProjectIdForSyncRef.current = existingInvoice.project_id ?? '';
    }
  }, [isEdit, existingInvoice]);

  const selectedClient = clientsData?.data.find((c) => c.id === clientId);
  const selectedProject = projectId ? clientProjects.find((p) => p.id === projectId) : undefined;
  const rawProjectHoursNum =
    selectedProject?.hours != null && String(selectedProject.hours).trim() !== ''
      ? Number(selectedProject.hours)
      : NaN;
  const projectHoursPositive =
    selectedProject && Number.isFinite(rawProjectHoursNum) && rawProjectHoursNum > 0 ? rawProjectHoursNum : null;
  /** Cap applies only when the project marks hours as a maximum. */
  const projectHoursCap =
    selectedProject?.hours_is_maximum && projectHoursPositive != null ? projectHoursPositive : null;

  const projectDescriptionTrimmed =
    selectedProject?.description != null && String(selectedProject.description).trim() !== ''
      ? String(selectedProject.description).trim()
      : '';
  const hasProjectDescription = Boolean(projectDescriptionTrimmed);

  useEffect(() => {
    if (!clientId) {
      prevProjectIdForSyncRef.current = '';
      return;
    }
    if (!projectId) {
      prevProjectIdForSyncRef.current = '';
      return;
    }
    if (!selectedProject) {
      return;
    }
    const changed = prevProjectIdForSyncRef.current !== projectId;
    prevProjectIdForSyncRef.current = projectId;
    if (!changed) return;

    setValue('items.0.description', projectDescriptionTrimmed);
    if (projectHoursPositive != null) {
      setValue('items.0.hours', projectHoursPositive);
    }
  }, [
    clientId,
    projectId,
    selectedProject,
    projectHoursPositive,
    projectDescriptionTrimmed,
    setValue,
  ]);

  const hourlyRate = settings?.defaultHourlyRate ?? 0;
  const subtotal = items.reduce((sum, row) => {
    if (!row.description?.trim()) return sum;
    const h = Number(row.hours);
    if (!Number.isFinite(h) || h <= 0) return sum;
    return sum + h * hourlyRate;
  }, 0);

  const buildPayload = (data: InvoiceFormData): InvoicePayload => {
    const taxRate = settings?.defaultTaxRate ?? 0;
    return {
    clientId: data.clientId,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    taxRate,
    notes: data.notes || undefined,
    projectId: data.projectId?.trim() || null,
    isRecurring: data.isRecurring,
    recurrenceInterval: data.isRecurring ? data.recurrenceInterval : undefined,
    items: data.items
      .filter((item) => item.description?.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Math.max(0, Number(item.hours)) || 0,
        unitPrice: settings?.defaultHourlyRate ?? 0,
      })),
  };
  };

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created');
      navigate('/invoices');
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const msg = (err.response.data as { error?: string })?.error;
        toast.error(msg || 'This project is already linked to another invoice');
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        return;
      }
      if (axios.isAxiosError(err) && err.response?.data) {
        const msg = (err.response.data as { error?: string }).error;
        if (typeof msg === 'string' && msg.trim()) {
          toast.error(msg);
          return;
        }
      }
      toast.error('Failed to create invoice');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: InvoicePayload }) =>
      updateInvoice(invoiceId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['revenue-stats'] });
      toast.success('Invoice updated');
      navigate(`/invoices/${variables.invoiceId}`);
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const msg = (err.response.data as { error?: string })?.error;
        toast.error(msg || 'This project is already linked to another invoice');
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        return;
      }
      if (axios.isAxiosError(err) && err.response?.data) {
        const msg = (err.response.data as { error?: string }).error;
        if (typeof msg === 'string' && msg.trim()) {
          toast.error(msg);
          return;
        }
      }
      toast.error('Failed to update invoice');
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    if (!data.items.some((i) => i.description?.trim())) {
      toast.error('Add at least one line with a description');
      return;
    }
    for (const row of data.items) {
      if (!row.description?.trim()) continue;
      const h = Number(row.hours);
      if (!Number.isFinite(h) || h <= 0) {
        toast.error('Enter a positive number of hours for each line item');
        return;
      }
    }
    if (projectHoursCap != null && sumBilledHours(data.items) > projectHoursCap + 1e-6) {
      toast.error(
        `Total hours on line items cannot exceed ${projectHoursCap} (maximum set for the selected project).`
      );
      return;
    }
    if (data.projectId?.trim() && blockProjectActions) {
      if (conflictCheckPending) {
        toast.error('Still checking this project for existing invoices — try again in a moment.');
        return;
      }
      toast.error(
        'This project is already linked to another invoice. Choose a different project or open the existing invoice.'
      );
      return;
    }
    if ((settings?.defaultHourlyRate ?? 0) <= 0) {
      toast.error('Set a default hourly rate under Settings before saving');
      return;
    }
    const payload = buildPayload(data);
    if (isEdit) {
      updateMutation.mutate({ invoiceId: id!, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handlePreview = handleSubmit((data) => {
    if (!data.clientId) {
      toast.error('Select a client');
      return;
    }
    if (data.projectId?.trim() && blockProjectActions) {
      toast.error(
        conflictCheckPending
          ? 'Wait for the project check to finish before previewing.'
          : 'Resolve the project conflict before previewing.'
      );
      return;
    }
    for (const row of data.items) {
      if (!row.description?.trim()) continue;
      const h = Number(row.hours);
      if (!Number.isFinite(h) || h <= 0) {
        toast.error('Enter a positive number of hours for each line item');
        return;
      }
    }
    if (projectHoursCap != null && sumBilledHours(data.items) > projectHoursCap + 1e-6) {
      toast.error(
        `Total hours on line items cannot exceed ${projectHoursCap} (maximum set for the selected project).`
      );
      return;
    }
    if ((settings?.defaultHourlyRate ?? 0) <= 0) {
      toast.error('Set a default hourly rate under Settings to preview');
      return;
    }
    const client = clientsData?.data.find((c) => c.id === data.clientId);
    const selectedProj = data.projectId?.trim()
      ? clientProjects.find((p) => p.id === data.projectId)
      : undefined;
    const linkList = projectExternalLinksFromProject(selectedProj);
    const inv = buildInvoiceFromForm(
      data,
      settings ?? null,
      client,
      discounts ?? [],
      existingInvoice ?? null,
      linkList.length ? { projectExternalLinks: linkList } : undefined
    );
    if (!inv) {
      toast.error('Add at least one line with a description');
      return;
    }
    setPreviewInvoice(inv);
    setPreviewOpen(true);
  });

  if (isEdit && invoiceLoading) {
    return <div className="text-center py-8 text-gray-400">Loading invoice...</div>;
  }
  if (isEdit && invoiceError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Could not load this invoice.</p>
        <Link to="/invoices" className="text-blue-600 hover:underline">Back to Invoices</Link>
      </div>
    );
  }
  if (isEdit && existingInvoice && existingInvoice.status !== 'draft') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-700 mb-4">Only draft invoices can be edited.</p>
        <Link to={`/invoices/${existingInvoice.id}`} className="text-blue-600 hover:underline">View invoice</Link>
      </div>
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-8 space-y-6">
        {/* Customer #, Client & Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer #</label>
            <input
              readOnly
              value={selectedClient?.customer_number ?? '—'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-mono text-sm"
              aria-live="polite"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1">
              <label className="text-sm font-medium text-gray-700">Client</label>
              {selectedClient && (
                <Link
                  to={`/clients/${encodeURIComponent(selectedClient.id)}#details`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View / edit client
                </Link>
              )}
            </div>
            <select
              {...register('clientId', { required: 'Client is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a client</option>
              {clientsData?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClientLabel(c)}
                </option>
              ))}
            </select>
            {errors.clientId && <p className="text-red-500 text-sm mt-1">{errors.clientId.message}</p>}
          </div>
        </div>
        {clientId ? (
          <div className="max-w-xl">
            <label htmlFor="invoice-project" className="block text-sm font-medium text-gray-700 mb-1">
              Related project (optional)
            </label>
            <select
              id="invoice-project"
              {...register('projectId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">None</option>
              {[...clientProjects]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Choose a project assigned to this client, or leave as none.</p>
            {projectId && conflictCheckPending && (
              <p className="mt-2 text-xs text-gray-600">Checking whether this project is already on an invoice…</p>
            )}
            {projectId && conflictCheckError && (
              <p className="mt-2 text-xs text-amber-800">
                Selected project already has an invoice, delete existing invoice before creating a new one.
              </p>
            )}
            {projectId && projectInvoiceConflicts.length > 0 && (
              <div
                className="mt-3 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                role="alert"
              >
                <p className="font-medium">This project is already linked to another invoice</p>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  {projectInvoiceConflicts.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/invoices/${c.id}`}
                        className="font-mono text-blue-800 underline hover:text-blue-950"
                      >
                        {c.invoice_number}
                      </Link>
                      <span className="text-amber-900/90"> ({c.status})</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-900/85">
                  Select a different project or open the invoice above. Invoices in <strong>cancelled</strong> status do
                  not block a new link.
                </p>
              </div>
            )}
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
            <input type="date" {...register('issueDate', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input type="date" {...register('dueDate', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>

        {/* Line items: description + hours; rate comes from Settings */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Line items</label>
          <p className="text-xs text-gray-500 mb-2">
            Each line uses your default hourly rate from Settings × hours worked.
          </p>
          {projectId && selectedProject && (projectHoursPositive != null || hasProjectDescription) && (
            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2 space-y-1">
              {hasProjectDescription && (
                <p>
                  The first line description is filled from the project. You can edit it or replace it.
                </p>
              )}
              {projectHoursPositive != null && (
                <p>
                  Project hours: <strong>{projectHoursPositive}</strong>
                  {projectHoursCap != null ? (
                    <> — each line is capped at this amount, and total billed hours cannot exceed it.</>
                  ) : (
                    <> — the first line hours field is set to this value when you select the project.</>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-12 gap-3 mb-2 text-xs text-gray-500">
            <div className="col-span-7 md:col-span-8">
              <span className="font-medium text-gray-500 uppercase tracking-wide">Description</span>
            </div>
            <div className="col-span-4 md:col-span-3">
              <span className="font-medium text-gray-500 uppercase tracking-wide">Hours</span>
            </div>
            <div className="col-span-1" />
          </div>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-7 md:col-span-8">
                  {index === 0 ? (
                    <textarea
                      {...register(`items.${index}.description`)}
                      placeholder="Describe work performed"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-y min-h-[4.5rem] text-sm"
                    />
                  ) : (
                    <input
                      {...register(`items.${index}.description`)}
                      placeholder="Describe work performed"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  )}
                </div>
                <div className="col-span-4 md:col-span-3">
                  <input
                    type="number"
                    min={0}
                    max={projectHoursCap ?? undefined}
                    step={0.25}
                    {...register(`items.${index}.hours`, {
                      valueAsNumber: true,
                      min: 0,
                      ...(projectHoursCap != null
                        ? {
                            max: projectHoursCap,
                            validate: (v) => {
                              const h = Number(v);
                              if (!Number.isFinite(h)) return true;
                              if (h > projectHoursCap + 1e-9) {
                                return `Hours cannot exceed ${projectHoursCap} (project maximum).`;
                              }
                              return true;
                            },
                          }
                        : {}),
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg tabular-nums"
                    aria-label={`Hours for line ${index + 1}`}
                  />
                </div>
                <div className="col-span-1 flex justify-end pb-2">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:text-red-700">
                      <HiOutlineTrash className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => append({ description: '', hours: 1 })}
            className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <HiOutlinePlus className="w-4 h-4" /> Add Item
          </button>
          <p className="text-right text-sm text-gray-500 mt-2">Subtotal: ${subtotal.toFixed(2)}</p>
        </div>

        {/* Tax, Discount, Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
            <input
              readOnly
              value={settings ? String(settings.defaultTaxRate) : '—'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800"
              aria-describedby="invoice-tax-rate-hint"
            />
            <p id="invoice-tax-rate-hint" className="text-xs text-gray-500 mt-1">
              From company settings. Change it under Settings.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
            <input
              readOnly
              value={
                selectedClient?.discount_code?.trim()
                  ? selectedClient.discount_code
                  : '—'
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800"
              aria-label="Client default discount code"
            />
            <p className="text-xs text-gray-500 mt-1">
              From the client profile. Change it under Clients.
            </p>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('isRecurring')} className="rounded" />
              <span className="text-sm text-gray-700">Recurring</span>
            </label>
            {watch('isRecurring') && (
              <select {...register('recurrenceInterval')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea {...register('notes')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional notes..." />
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => navigate(isEdit ? `/invoices/${id}` : '/invoices')} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={saving || blockProjectActions}
            className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            Preview invoice
          </button>
          <button
            type="submit"
            disabled={saving || blockProjectActions}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save changes' : 'Create Invoice'}
          </button>
        </div>
      </form>

      <InvoicePreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewInvoice(null);
        }}
        invoice={previewInvoice}
        company={settings ?? null}
        variant="draft"
        title={isEdit ? 'Preview invoice (unsaved changes)' : 'Preview invoice (draft)'}
      />
    </div>
  );
}
