import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { createInvoice, updateInvoice, getInvoice, type InvoicePayload } from '../api/invoices';
import { getDiscounts } from '../api/discounts';
import { getClients } from '../api/clients';
import { getSettings } from '../api/settings';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { buildInvoiceFromForm } from '../utils/invoicePreview';
import type { Invoice } from '../types';
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { formatClientLabel } from '../utils/clientDisplay';

interface InvoiceFormData {
  clientId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  isRecurring: boolean;
  recurrenceInterval: string;
  items: { description: string }[];
}

export function NewInvoicePage() {
  const { id } = useParams<{ id?: string }>();
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

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<InvoiceFormData>({
    defaultValues: {
      issueDate: today,
      dueDate: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
      isRecurring: false,
      items: [{ description: '' }],
    },
  });

  useEffect(() => {
    if (!isEdit || !existingInvoice) return;
    const lineItems = existingInvoice.items?.length
      ? existingInvoice.items.map((item) => ({
          description: item.description,
        }))
      : [{ description: '' }];

    reset({
      clientId: existingInvoice.client_id,
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
  const selectedClient = clientsData?.data.find((c) => c.id === clientId);
  const hourlyRate = settings?.defaultHourlyRate ?? 0;
  const subtotal = items.reduce(
    (sum, row) => sum + (row.description?.trim() ? hourlyRate : 0),
    0
  );

  const buildPayload = (data: InvoiceFormData): InvoicePayload => {
    const taxRate = settings?.defaultTaxRate ?? 0;
    return {
    clientId: data.clientId,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    taxRate,
    notes: data.notes || undefined,
    isRecurring: data.isRecurring,
    recurrenceInterval: data.isRecurring ? data.recurrenceInterval : undefined,
    items: data.items
      .filter((item) => item.description?.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: 1,
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
    onError: () => toast.error('Failed to create invoice'),
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
    onError: () => toast.error('Failed to update invoice'),
  });

  const onSubmit = (data: InvoiceFormData) => {
    if (!data.items.some((i) => i.description?.trim())) {
      toast.error('Add at least one line with a description');
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
    const client = clientsData?.data.find((c) => c.id === data.clientId);
    const inv = buildInvoiceFromForm(
      data,
      settings ?? null,
      client,
      discounts ?? [],
      existingInvoice ?? null
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
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

        {/* Description (line items): one hour per row at company hourly rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <div className="grid grid-cols-12 gap-3 mb-2 text-xs text-gray-500">
            <div className="col-span-7 md:col-span-8" />
            <div className="col-span-4 md:col-span-3">
              <span className="font-medium text-gray-500 uppercase tracking-wide">Hourly Rate</span>
              <p className="text-[11px] font-normal normal-case mt-0.5">From company settings</p>
            </div>
            <div className="col-span-1" />
          </div>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-7 md:col-span-8">
                  <input
                    {...register(`items.${index}.description`)}
                    placeholder="Describe work performed"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="col-span-4 md:col-span-3">
                  <input
                    readOnly
                    value={settings ? String(settings.defaultHourlyRate ?? 0) : '—'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800"
                    aria-label={`Hourly rate for line ${index + 1}`}
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
            onClick={() => append({ description: '' })}
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
            disabled={saving}
            className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            Preview invoice
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
