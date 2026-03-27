import axios from 'axios';
import portalClient from './portalClient';
import type { Project } from './projects';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export interface PortalLoginResponse {
  token: string;
  client: { id: string; name: string; email: string; company?: string | null };
  vendor: { businessName?: string | null };
  portal: { twoFactorEnabled: boolean };
}

export interface PortalMeResponse {
  client: { id: string; name: string; email: string; company?: string | null };
  vendor: { businessName?: string | null };
  portal: { twoFactorEnabled: boolean };
  stats: {
    visibleInvoices: number;
    openInvoices: number;
    outstandingTotal: string;
    projectCount: number;
  };
}

export async function portalLogin(body: {
  accessToken?: string;
  email?: string;
  password: string;
  totpCode?: string;
}): Promise<PortalLoginResponse | { requiresTwoFactor: true; message?: string }> {
  const { data } = await axios.post(`${apiBase}/portal/auth/login`, {
    accessToken: body.accessToken,
    email: body.email,
    password: body.password,
    totpCode: body.totpCode,
  });
  return data;
}

export async function getPortalMe(): Promise<PortalMeResponse> {
  const { data } = await portalClient.get('/portal/me');
  return data;
}

export async function getPortalInvoices(): Promise<{
  data: {
    id: string;
    invoice_number: string;
    status: string;
    issue_date: string;
    due_date: string;
    total: string;
    tax_amount: string;
    updated_at: string;
    sent_at?: string | null;
  }[];
}> {
  const { data } = await portalClient.get('/portal/invoices');
  return data;
}

export async function getPortalProjects(): Promise<{
  data: {
    id: string;
    name: string;
    status: string;
    priority: string;
    start_date: string | null;
    end_date: string | null;
    budget: string | null;
    updated_at: string;
  }[];
}> {
  const { data } = await portalClient.get('/portal/projects');
  return data;
}

export async function getPortalProject(projectId: string): Promise<Project> {
  const { data } = await portalClient.get(`/portal/projects/${projectId}`);
  return data;
}

export async function getPortalNotifications(): Promise<{
  data: { id: string; kind: 'invoice' | 'project'; title: string; detail: string; at: string }[];
}> {
  const { data } = await portalClient.get('/portal/notifications');
  return data;
}

export async function portal2faSetup(): Promise<{ qrDataUrl: string; otpauthUrl: string; secret: string }> {
  const { data } = await portalClient.post('/portal/2fa/setup');
  return data;
}

export async function portal2faEnable(code: string): Promise<{ ok: boolean }> {
  const { data } = await portalClient.post('/portal/2fa/enable', { code });
  return data;
}

export async function portal2faDisable(password: string): Promise<{ ok: boolean }> {
  const { data } = await portalClient.post('/portal/2fa/disable', { password });
  return data;
}

export async function getPortalAccount(): Promise<{
  email: string | null;
  twoFactorEnabled: boolean;
  canSetPasswordWithoutCurrent?: boolean;
}> {
  const { data } = await portalClient.get('/portal/account');
  return data;
}

export async function updatePortalAccount(body: {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<{
  email: string | null;
  twoFactorEnabled: boolean;
  canSetPasswordWithoutCurrent?: boolean;
}> {
  const { data } = await portalClient.put('/portal/account', body);
  return data;
}
