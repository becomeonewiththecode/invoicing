import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { getDiscounts, createDiscount, deleteDiscount, generateDiscountCode } from '../api/discounts';

interface DiscountFormData {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number | undefined;
}

export function DiscountsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: discounts, isLoading } = useQuery({
    queryKey: ['discounts'],
    queryFn: getDiscounts,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DiscountFormData>({
    defaultValues: { type: 'percent' },
  });

  useEffect(() => {
    if (!showForm) return;
    let cancelled = false;
    (async () => {
      try {
        const { code } = await generateDiscountCode();
        if (cancelled) return;
        reset({ code, type: 'percent', description: '', value: undefined });
        setValue('code', code);
      } catch {
        if (!cancelled) toast.error('Could not generate a discount code');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showForm, reset, setValue]);

  const regenerateCode = async () => {
    try {
      const { code } = await generateDiscountCode();
      setValue('code', code);
    } catch {
      toast.error('Could not generate a new code');
    }
  };

  const createMutation = useMutation({
    mutationFn: createDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount code created');
      setShowForm(false);
      reset();
    },
    onError: () => toast.error('Failed to create discount code'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount code deleted');
    },
  });

  const onSubmit = (data: DiscountFormData) => {
    createMutation.mutate({
      code: data.code,
      value: Number(data.value),
      type: data.type,
      description: data.description || undefined,
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Discount Codes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          {showForm ? 'Cancel' : 'New Discount'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-surface rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Code</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  {...register('code', { required: 'Code is required' })}
                  className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg bg-surface-alt font-mono text-sm"
                  aria-describedby="discount-code-hint"
                />
                <button
                  type="button"
                  onClick={regenerateCode}
                  className="shrink-0 px-3 py-2 text-sm border border-input-border rounded-lg text-text-secondary hover:bg-surface-alt"
                >
                  New code
                </button>
              </div>
              <p id="discount-code-hint" className="text-xs text-text-muted mt-1">
                Generated automatically. Use “New code” if you want a different one before saving.
              </p>
              {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Type</label>
              <select {...register('type')} className="w-full px-3 py-2 border border-input-border rounded-lg">
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Value *</label>
              <input type="number" step="0.01" {...register('value', { required: 'Value is required', min: { value: 0.01, message: 'Must be positive' } })} className="w-full px-3 py-2 border border-input-border rounded-lg" />
              {errors.value && <p className="text-red-500 text-sm mt-1">{errors.value.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
              <input {...register('description')} className="w-full px-3 py-2 border border-input-border rounded-lg" placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create Discount'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-alt border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Code</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Description</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Type</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-text-muted">Value</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-faint">Loading...</td></tr>
            ) : !discounts?.length ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-faint">No discount codes</td></tr>
            ) : (
              discounts.map((d) => (
                <tr key={d.id} className="hover:bg-surface-alt">
                  <td className="px-6 py-4 font-mono font-medium">{d.code}</td>
                  <td className="px-6 py-4 text-text-secondary">{d.description || '-'}</td>
                  <td className="px-6 py-4 text-text-secondary capitalize">{d.type}</td>
                  <td className="px-6 py-4 text-text-secondary">{d.type === 'percent' ? `${d.value}%` : `$${Number(d.value).toFixed(2)}`}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { if (confirm('Delete this discount code?')) deleteMutation.mutate(d.id); }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
