import api from './client';
import type { PaginatedResponse } from '../types';
import type { SupportTicket, TicketDetail } from '../types/admin';

export const submitTicket = (data: { subject: string; body: string; priority?: string }) =>
  api.post<SupportTicket>('/tickets', data).then((r) => r.data);

export const getMyTickets = (page = 1, limit = 20) =>
  api.get<PaginatedResponse<SupportTicket>>('/tickets', { params: { page, limit } }).then((r) => r.data);

export const getTicketDetail = (id: string) => api.get<TicketDetail>(`/tickets/${id}`).then((r) => r.data);

export const replyToTicket = (id: string, body: string) =>
  api.post(`/tickets/${id}/reply`, { body }).then((r) => r.data);
