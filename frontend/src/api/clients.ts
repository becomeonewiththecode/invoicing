import api from './client';
import type { Client, PaginatedResponse } from '../types';

export async function getClients(page = 1, limit = 20): Promise<PaginatedResponse<Client>> {
  const { data } = await api.get('/clients', { params: { page, limit } });
  return data;
}

export async function getClient(id: string): Promise<Client> {
  const { data } = await api.get(`/clients/${id}`);
  return data;
}

export async function createClient(client: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  discountCode?: string | null;
}): Promise<Client> {
  const { data } = await api.post('/clients', client);
  return data;
}

export async function updateClient(id: string, client: Partial<Client>): Promise<Client> {
  const { data } = await api.put(`/clients/${id}`, client);
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`);
}
