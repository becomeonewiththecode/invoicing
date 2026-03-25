import api from './client';
import type { UserSettings } from '../types';

export async function getSettings(): Promise<UserSettings> {
  const { data } = await api.get<UserSettings>('/settings');
  return data;
}

export type SettingsUpdatePayload = {
  businessName: string;
  defaultTaxRate: number;
  businessPhone: string;
  businessWebsite: string;
  businessAddress?: string;
  taxId?: string;
  defaultHourlyRate?: number | null;
  businessFax?: string;
  businessEmail?: string;
  logoUrl?: string;
  payableText?: string;
};

export async function updateSettings(body: SettingsUpdatePayload): Promise<UserSettings> {
  const { data } = await api.put<UserSettings>('/settings', body);
  return data;
}

export async function uploadLogo(file: File): Promise<UserSettings> {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('logo', file);
  const res = await fetch(`${base.replace(/\/$/, '')}/settings/logo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Upload failed');
  }
  return res.json() as Promise<UserSettings>;
}

export async function deleteLogo(): Promise<UserSettings> {
  const { data } = await api.delete<UserSettings>('/settings/logo');
  return data;
}

export interface SmtpSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const { data } = await api.get<SmtpSettings>('/settings/smtp');
  return data;
}

export async function updateSmtpSettings(body: SmtpSettings): Promise<SmtpSettings> {
  const { data } = await api.put<SmtpSettings>('/settings/smtp', body);
  return data;
}

export async function sendSmtpTest(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/settings/smtp/test');
  return data;
}
