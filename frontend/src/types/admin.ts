export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  openTickets: number;
  pendingFlags: number;
  totalInvoices: number;
  platformRevenue: number;
}

export interface UserGrowthPoint {
  date: string;
  count: number;
}

export interface UserListItem {
  id: string;
  email: string;
  business_name: string | null;
  role: string;
  invoice_count: number;
  created_at: string;
}

export interface UserDetail extends UserListItem {
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  business_website: string | null;
  client_count: number;
  total_revenue: number;
}

export interface ContentFlag {
  id: string;
  user_id: string;
  user_email: string;
  content_type: string;
  content_snippet: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_email: string;
  body: string;
  is_admin_reply: boolean;
  created_at: string;
}

export interface TicketDetail extends SupportTicket {
  messages: TicketMessage[];
}

export interface ServiceCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTimeMs: number;
  message?: string;
}

export interface HealthStatus {
  services: ServiceCheck[];
  errorRate: number;
  avgResponseTime: number;
  requestsLastHour: number;
}

export interface SystemLog {
  id: string;
  level: string;
  source: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  ip: string | null;
  user_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BackupSnapshot {
  id: string;
  user_id: string;
  user_email?: string;
  file_path: string;
  file_size_bytes: number;
  is_automated: boolean;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface BackupPolicy {
  id: string;
  user_id: string | null;
  user_email?: string;
  retention_days: number;
  max_snapshots: number;
  is_enabled: boolean;
  cron_expression: string;
  created_at: string;
  updated_at: string;
}

export interface RateLimitConfig {
  id: string;
  route_pattern: string;
  window_ms: number;
  max_requests: number;
  is_enabled: boolean;
  updated_at: string;
}

export interface RateLimitAnalytics {
  totalRequests: number;
  blockedRequests: number;
  blockRate: number;
  topIps: { ip: string; count: number; blocked: number }[];
  topRoutes: { path: string; count: number; blocked: number }[];
  timeline: { time: string; requests: number; blocked: number }[];
}
