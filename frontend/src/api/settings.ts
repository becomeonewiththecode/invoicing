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
  logoUrl?: string;
};

export async function updateSettings(body: SettingsUpdatePayload): Promise<UserSettings> {
  const { data } = await api.put<UserSettings>('/settings', body);
  return data;
}
