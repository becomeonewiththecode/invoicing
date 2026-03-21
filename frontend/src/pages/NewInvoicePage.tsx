import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { createInvoice } from '../api/invoices';
import { getClients } from '../api/clients';
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';

interface InvoiceFormData {
  clientId: string;
  issueDate: string;
  dueDate: string;
  taxRate: number;
  discountCode: string;
  notes: string;
  isRecurring: boolean;
  recurrenceInterval: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}

export function NewInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 1, 100],
    queryFn: () => getClients(1, 100),
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<InvoiceFormData>({
    defaultValues: {
      issueDate: today,
      dueDate: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
      taxRate: 0,
      isRecurring: false,
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created');
      navigate('/invoices');
    },
    onError: () => toast.error('Failed to create invoice'),
  });

  const onSubmit = (data: InvoiceFormData) => {
    mutation.mutate({
      ...data,
      taxRate: Number(data.taxRate),
      discountCode: data.discountCode || undefined,
      recurrenceInterval: data.isRecurring ? data.recurrenceInterval : undefined,
      items: data.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Invoice</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-8 space-y-6">
        {/* Client & Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              {...register('clientId', { required: 'Client is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a client</option>
              {clientsData?.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
              ))}
            </select>
            {errors.clientId && <p className="text-red-500 text-sm mt-1">{errors.clientId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
            <input type="date" {...register('issueDate', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input type="date" {...register('dueDate', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>

        {/* Line items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-6">
                  <input
                    {...register(`items.${index}.description`, { required: 'Required' })}
                    placeholder="Description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    {...register(`items.${index}.quantity`, { required: true, min: 0.01 })}
                    placeholder="Qty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    step="0.01"
                    {...register(`items.${index}.unitPrice`, { required: true, min: 0 })}
                    placeholder="Unit Price"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="col-span-1">
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
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
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
            <input type="number" step="0.01" {...register('taxRate')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Code</label>
            <input {...register('discountCode')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
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

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/invoices')} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
