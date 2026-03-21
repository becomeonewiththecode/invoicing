import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { getClients, createClient, deleteClient } from '../api/clients';

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
}

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page],
    queryFn: () => getClients(page),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>();

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created');
      setShowForm(false);
      reset();
    },
    onError: () => toast.error('Failed to create client'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
    },
    onError: () => toast.error('Failed to delete client. They may have existing invoices.'),
  });

  const onSubmit = (data: ClientFormData) => {
    createMutation.mutate({
      ...data,
      phone: data.phone || undefined,
      company: data.company || undefined,
      address: data.address || undefined,
      notes: data.notes || undefined,
    });
  };

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.limit) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'New Client'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input {...register('name', { required: 'Name is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" {...register('email', { required: 'Email is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input {...register('phone')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input {...register('company')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input {...register('address')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Company</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Phone</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No clients found</td></tr>
            ) : (
              data?.data.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{client.name}</td>
                  <td className="px-6 py-4 text-gray-600">{client.email}</td>
                  <td className="px-6 py-4 text-gray-600">{client.company || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{client.phone || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { if (confirm('Delete this client?')) deleteMutation.mutate(client.id); }}
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

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border disabled:opacity-50">Previous</button>
            <span className="px-3 py-1 text-gray-600">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
