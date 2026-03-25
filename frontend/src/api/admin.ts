import api from './client';
import type { PaginatedResponse } from '../types';
import type {
  AdminStats,
  UserGrowthPoint,
  UserListItem,
  UserDetail,
  ContentFlag,
  SupportTicket,
  TicketDetail,
  HealthStatus,
  SystemLog,
  BackupSnapshot,
  BackupPolicy,
  RateLimitConfig,
  RateLimitAnalytics,
} from '../types/admin';

// Dashboard
export const getAdminDashboard = () => api.get<AdminStats>('/admin/dashboard/stats').then((r) => r.data);
export const getUserGrowth = (days = 30) =>
  api.get<UserGrowthPoint[]>('/admin/dashboard/user-growth', { params: { days } }).then((r) => r.data);

// Users
export const getAdminUsers = (page = 1, limit = 20, search?: string) =>
  api.get<PaginatedResponse<UserListItem>>('/admin/users', { params: { page, limit, search } }).then((r) => r.data);
export const getAdminUserDetail = (id: string) => api.get<UserDetail>(`/admin/users/${id}`).then((r) => r.data);
export const updateUserRole = (id: string, role: string) =>
  api.put(`/admin/users/${id}/role`, { role }).then((r) => r.data);
export const flagUserContent = (userId: string, data: { contentType: string; contentSnippet: string; reason?: string }) =>
  api.post(`/admin/users/${userId}/flag`, data).then((r) => r.data);

// Moderation
export const getModerationQueue = (status = 'pending', page = 1, limit = 20) =>
  api.get<PaginatedResponse<ContentFlag>>('/admin/moderation', { params: { status, page, limit } }).then((r) => r.data);
export const reviewFlag = (id: string, decision: 'approved' | 'rejected') =>
  api.put(`/admin/moderation/${id}`, { decision }).then((r) => r.data);
export const bulkReviewFlags = (flagIds: string[], decision: 'approved' | 'rejected') =>
  api.post('/admin/moderation/bulk', { flagIds, decision }).then((r) => r.data);

// Tickets
export const getAdminTickets = (page = 1, limit = 20, filters?: { status?: string; priority?: string; search?: string }) =>
  api.get<PaginatedResponse<SupportTicket>>('/admin/tickets', { params: { page, limit, ...filters } }).then((r) => r.data);
export const getAdminTicketDetail = (id: string) => api.get<TicketDetail>(`/admin/tickets/${id}`).then((r) => r.data);
export const adminReplyToTicket = (id: string, body: string) =>
  api.post(`/admin/tickets/${id}/reply`, { body }).then((r) => r.data);
export const updateTicketStatus = (id: string, status: string) =>
  api.put(`/admin/tickets/${id}/status`, { status }).then((r) => r.data);

// Health
export const getHealthStatus = () => api.get<HealthStatus>('/admin/health').then((r) => r.data);
export const getSystemLogs = (page = 1, limit = 20, filters?: { level?: string; source?: string }) =>
  api.get<PaginatedResponse<SystemLog>>('/admin/health/logs', { params: { page, limit, ...filters } }).then((r) => r.data);

// Backups
export const getBackups = (page = 1, limit = 20, userId?: string) =>
  api.get<PaginatedResponse<BackupSnapshot>>('/admin/backups', { params: { page, limit, userId } }).then((r) => r.data);
export const triggerBackup = (userId: string) => api.post<BackupSnapshot>(`/admin/backups/${userId}`).then((r) => r.data);
export const restoreBackup = (snapshotId: string) =>
  api.post(`/admin/backups/${snapshotId}/restore`).then((r) => r.data);
export const verifyBackup = (snapshotId: string) =>
  api.post(`/admin/backups/${snapshotId}/verify`).then((r) => r.data);
export const deleteBackup = (snapshotId: string) => api.delete(`/admin/backups/${snapshotId}`).then((r) => r.data);
export const getBackupPolicies = () => api.get<BackupPolicy[]>('/admin/backups/policies').then((r) => r.data);
export const updateBackupPolicy = (id: string, data: Partial<BackupPolicy>) =>
  api.put(`/admin/backups/policies/${id}`, data).then((r) => r.data);

// Rate Limits
export const getRateLimitConfigs = () => api.get<RateLimitConfig[]>('/admin/rate-limits').then((r) => r.data);
export const createRateLimitConfig = (data: Omit<RateLimitConfig, 'id' | 'updated_at'>) =>
  api.post<RateLimitConfig>('/admin/rate-limits', data).then((r) => r.data);
export const updateRateLimitConfig = (id: string, data: Partial<RateLimitConfig>) =>
  api.put<RateLimitConfig>(`/admin/rate-limits/${id}`, data).then((r) => r.data);
export const getRateLimitAnalytics = (hours = 24) =>
  api.get<RateLimitAnalytics>('/admin/rate-limits/analytics', { params: { hours } }).then((r) => r.data);
