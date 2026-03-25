import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getClients, createClient, updateClient, deleteClient } from '../api/clients';
import { getDiscounts } from '../api/discounts';
import type { Client } from '../types';
import { formatClientLabel } from '../utils/clientDisplay';

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  discountCode: string;
}

type FormDraft = null | { type: 'create' } | { type: 'edit'; client: Client };

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<FormDraft>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['clients', page],
    queryFn: () => getClients(page),
  });

  const { data: discounts } = useQuery({
    queryKey: ['discounts'],
    queryFn: getDiscounts,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>();

  /** Deep link from invoices: /clients?edit=<uuid> → client profile */
  const editFromQuery = searchParams.get('edit');
  useEffect(() => {
    if (!editFromQuery) return;
    navigate(`/clients/${editFromQuery}#details`, { replace: true });
  }, [editFromQuery, navigate]);

  useEffect(() => {
    if (!draft) return;
    if (draft.type === 'create') {
      reset({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        notes: '',
        discountCode: '',
      });
    } else {
      const c = draft.client;
      reset({
        name: c.name,
        email: c.email,
        phone: c.phone ?? '',
        company: c.company ?? '',
        address: c.address ?? '',
        notes: c.notes ?? '',
        discountCode: c.discount_code ?? '',
      });
    }
  }, [draft, reset]);

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created');
      setDraft(null);
    },
    onError: () => toast.error('Failed to create client'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateClient>[1] }) =>
      updateClient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated');
      setDraft(null);
    },
    onError: (err: unknown) => {
      const data = err as { response?: { data?: { error?: string } } };
      toast.error(data.response?.data?.error ?? 'Failed to update client');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
    },
    onError: (err: unknown, id: string) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const count = (err.response.data as { invoiceCount?: number }).invoiceCount ?? 0;
        toast.error(`Client has ${count} invoice(s). Use the client profile to force delete.`);
        navigate(`/clients/${id}`);
      } else {
        toast.error('Failed to delete client');
      }
    },
  });

  const toPayload = (data: ClientFormData) => ({
    name: data.name,
    email: data.email,
    phone: data.phone || undefined,
    company: data.company || undefined,
    address: data.address || undefined,
    notes: data.notes || undefined,
    discountCode: data.discountCode.trim() || null,
  });

  const onSubmit = (data: ClientFormData) => {
    if (draft?.type === 'edit') {
      updateMutation.mutate({ id: draft.client.id, payload: toPayload(data) });
    } else {
      createMutation.mutate(toPayload(data));
    }
  };

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.limit) : 0;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click a client name or Profile to open their page (details, invoice status, and invoice links).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedClientId && (
            <Link
              to={`/clients/${encodeURIComponent(selectedClientId)}#invoices`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View profile
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSelectedClientId(null)}
            disabled={!selectedClientId}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Clear selection
          </button>
          <button
            onClick={() => setDraft((d) => (d?.type === 'create' ? null : { type: 'create' }))}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {draft?.type === 'create' ? 'Cancel' : 'New Client'}
          </button>
        </div>
      </div>

      {draft && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {draft.type === 'edit' ? 'Edit client' : 'New client'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {draft.type === 'edit' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer #</label>
                <input
                  readOnly
                  value={draft.client.customer_number ?? '—'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                />
              </div>
            )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Default discount code</label>
              <select
                {...register('discountCode')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">No discount</option>
                {draft.type === 'edit' &&
                  draft.client.discount_code?.trim() &&
                  !(discounts ?? []).some(
                    (d) => d.is_active && d.code === draft.client.discount_code
                  ) && (
                    <option value={draft.client.discount_code}>
                      {draft.client.discount_code} (inactive or removed)
                    </option>
                  )}
                {(discounts ?? [])
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.id} value={d.code}>
                      {d.code}
                      {d.description ? ` — ${d.description}` : ''}
                    </option>
                  ))}
              </select>
              {(discounts ?? []).filter((d) => d.is_active).length === 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                  No discount codes yet.{' '}
                  <Link to="/discounts" className="text-blue-600 hover:underline font-medium">
                    Create a code
                  </Link>{' '}
                  first (percent or fixed amount), then choose it from the list above.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                This code is applied to every invoice for this client. Codes are managed in{' '}
                <Link to="/discounts" className="text-blue-600 hover:underline">
                  Discount codes
                </Link>
                .
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...register('notes')} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {draft.type === 'edit'
                ? updateMutation.isPending
                  ? 'Saving...'
                  : 'Save changes'
                : createMutation.isPending
                  ? 'Creating...'
                  : 'Create client'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th scope="col" className="w-12 px-3 py-3 text-sm font-medium text-gray-500">
                <span className="sr-only">Select</span>
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Client</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Phone</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isPending ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : isError ? (
              <tr><td colSpan={5} className="text-center py-8 text-red-600">Could not load clients{error instanceof Error ? `: ${error.message}` : ''}</td></tr>
            ) : (data?.data?.length ?? 0) === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No clients found</td></tr>
            ) : (
              data!.data.map((client) => (
                <tr
                  key={client.id}
                  className={`hover:bg-gray-50 ${selectedClientId === client.id ? 'bg-blue-50/90' : ''}`}
                >
                  <td className="px-3 py-4 align-middle">
                    <input
                      type="radio"
                      name="client-selection"
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedClientId === client.id}
                      onChange={() => setSelectedClientId(client.id)}
                      aria-label={`Select ${formatClientLabel(client)}`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/clients/${encodeURIComponent(client.id)}`}
                      className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {formatClientLabel(client)}
                    </Link>
                    {client.company?.trim() &&
                      client.name.trim() &&
                      client.name.trim() !== client.company.trim() && (
                        <span className="block text-sm text-gray-500 mt-0.5">{client.name}</span>
                      )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{client.email}</td>
                  <td className="px-6 py-4 text-gray-600">{client.phone || '-'}</td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <Link
                      to={`/clients/${encodeURIComponent(client.id)}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDraft({ type: 'edit', client })}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Quick edit
                    </button>
                    <button
                      type="button"
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
