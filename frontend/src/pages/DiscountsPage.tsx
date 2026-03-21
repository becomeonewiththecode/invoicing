import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { getDiscounts, createDiscount, deleteDiscount } from '../api/discounts';

interface DiscountFormData {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
}

export function DiscountsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: discounts, isLoading } = useQuery({
    queryKey: ['discounts'],
    queryFn: getDiscounts,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DiscountFormData>({
    defaultValues: { type: 'percent' },
  });

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
      ...data,
      value: Number(data.value),
      description: data.description || undefined,
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Discount Codes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'New Discount'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input {...register('code', { required: 'Code is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg uppercase" />
              {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...register('type')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
              <input type="number" step="0.01" {...register('value', { required: 'Value is required', min: { value: 0.01, message: 'Must be positive' } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {errors.value && <p className="text-red-500 text-sm mt-1">{errors.value.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input {...register('description')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create Discount'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Code</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Description</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Type</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Value</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : !discounts?.length ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No discount codes</td></tr>
            ) : (
              discounts.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono font-medium">{d.code}</td>
                  <td className="px-6 py-4 text-gray-600">{d.description || '-'}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{d.type}</td>
                  <td className="px-6 py-4 text-gray-600">{d.type === 'percent' ? `${d.value}%` : `$${Number(d.value).toFixed(2)}`}</td>
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
