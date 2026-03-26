import api from './client';
import type { User } from '../types';

interface AuthResponse {
  user: User;
  token: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function register(email: string, password: string, businessName?: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password, businessName });
  return data;
}

export async function updateAccount(payload: {
  currentPassword: string;
  newEmail?: string;
  newPassword?: string;
}): Promise<AuthResponse> {
  const { data } = await api.put<AuthResponse>('/auth/account', payload);
  return data;
}
