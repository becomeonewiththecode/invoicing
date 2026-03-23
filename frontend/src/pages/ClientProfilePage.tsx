import { useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getClient, updateClient, deleteClient } from '../api/clients';
import { getDiscounts } from '../api/discounts';
import { getClientInvoiceStats, getInvoices } from '../api/invoices';
import { formatClientLabel } from '../utils/clientDisplay';
import { StatusBadge } from '../components/common/StatusBadge';
import type { ClientInvoiceStats } from '../types';

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  discountCode: string;
}

function money(s: string | undefined) {
  return `$${Number(s ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATS_ROWS: {
  label: string;
  countKey: keyof ClientInvoiceStats;
  totalKey: keyof ClientInvoiceStats;
  color: string;
}[] = [
  { label: 'Draft', countKey: 'draft_count', totalKey: 'draft_total', color: 'text-gray-700' },
  { label: 'Sent', countKey: 'sent_count', totalKey: 'sent_total', color: 'text-blue-600' },
  { label: 'Paid', countKey: 'paid_count', totalKey: 'paid_total', color: 'text-green-600' },
  { label: 'Late', countKey: 'late_count', totalKey: 'late_total', color: 'text-red-600' },
];

export function ClientProfilePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId!),
    enabled: !!clientId,
  });

  const { data: discounts } = useQuery({
    queryKey: ['discounts'],
    queryFn: getDiscounts,
  });

  const statsQuery = useQuery({
    queryKey: ['client-invoice-stats', clientId],
    queryFn: () => getClientInvoiceStats(clientId!),
    enabled: !!clientId && clientQuery.isSuccess,
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices', 1, 50, clientId],
    queryFn: () => getInvoices(1, 50, clientId),
    enabled: !!clientId && clientQuery.isSuccess,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>();

  useEffect(() => {
    const c = clientQuery.data;
    if (!c) return;
    reset({
      name: c.name,
      email: c.email,
      phone: c.phone ?? '',
      company: c.company ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
      discountCode: c.discount_code ?? '',
    });
  }, [clientQuery.data, reset]);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, clientId, clientQuery.isSuccess]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateClient>[1]) => updateClient(clientId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-invoice-stats', clientId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Client updated');
    },
    onError: (err: unknown) => {
      const data = err as { response?: { data?: { error?: string } } };
      toast.error(data.response?.data?.error ?? 'Failed to update client');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClient(clientId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
      navigate('/clients');
    },
    onError: () => toast.error('Failed to delete client. They may have existing invoices.'),
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
    updateMutation.mutate(toPayload(data));
  };

  if (!clientId) {
    return <p className="text-gray-500">Missing client.</p>;
  }

  if (clientQuery.isError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Client not found.</p>
        <Link to="/clients" className="text-blue-600 hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  if (clientQuery.isPending || !clientQuery.data) {
    return <p className="text-gray-400 py-8 text-center">Loading client…</p>;
  }

  const client = clientQuery.data;
  const s = statsQuery.data;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/clients" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to clients
          </Link>
          <h1 className="text-2xl font-bold mt-2">{formatClientLabel(client)}</h1>
          <p className="text-sm text-gray-500 mt-1">Customer # {client.customer_number ?? '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/invoices?clientId=${encodeURIComponent(clientId)}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Full invoice list
          </Link>
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this client?')) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm disabled:opacity-50"
          >
            Delete client
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 -mt-6">
        Jump to:{' '}
        <a href="#details" className="text-blue-600 hover:underline">
          Details
        </a>
        {' · '}
        <a href="#invoice-status" className="text-blue-600 hover:underline">
          Invoice status
        </a>
        {' · '}
        <a href="#invoices" className="text-blue-600 hover:underline">
          Invoices
        </a>
      </p>

      {/* Update client details */}
      <section id="details" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Client details</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer #</label>
              <input
                readOnly
                value={client.customer_number ?? '—'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
            <div />
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
              <select {...register('discountCode')} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="">No discount</option>
                {client.discount_code?.trim() &&
                  !(discounts ?? []).some((d) => d.is_active && d.code === client.discount_code) && (
                    <option value={client.discount_code}>
                      {client.discount_code} (inactive or removed)
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
                  </Link>
                  .
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Codes are managed in{' '}
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
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Invoice status */}
      <section id="invoice-status" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice status</h2>
        <p className="text-sm text-gray-600 mb-4">Counts and totals for this client only.</p>
        {statsQuery.isPending && <p className="text-gray-400">Loading stats…</p>}
        {statsQuery.isError && <p className="text-red-600">Could not load invoice stats.</p>}
        {s && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS_ROWS.map((row) => (
              <div key={row.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm font-medium text-gray-500">{row.label}</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${row.color}`}>
                  {Number(s[row.countKey] ?? 0)} invoices
                </p>
                <p className="text-sm text-gray-600 mt-2 tabular-nums">Total {money(s[row.totalKey])}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invoice links */}
      <section id="invoices" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h2>
        <p className="text-sm text-gray-600 mb-4">
          Open an invoice or use{' '}
          <Link to={`/invoices?clientId=${encodeURIComponent(clientId)}`} className="text-blue-600 hover:underline font-medium">
            filtered list
          </Link>{' '}
          for exports and pagination.
        </p>
        {invoicesQuery.isPending && <p className="text-gray-400">Loading invoices…</p>}
        {invoicesQuery.isError && <p className="text-red-600">Could not load invoices.</p>}
        {invoicesQuery.data && invoicesQuery.data.data.length === 0 && (
          <p className="text-gray-500 py-4">No invoices for this client yet.</p>
        )}
        {invoicesQuery.data && invoicesQuery.data.data.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Due</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoicesQuery.data.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.due_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">${Number(inv.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
