import api from './client';
import type { DiscountCode } from '../types';

export async function getDiscounts(): Promise<DiscountCode[]> {
  const { data } = await api.get('/discounts');
  return data;
}

export async function createDiscount(discount: {
  code: string;
  description?: string;
  type: 'percent' | 'fixed';
  value: number;
}): Promise<DiscountCode> {
  const { data } = await api.post('/discounts', discount);
  return data;
}

export async function deleteDiscount(id: string): Promise<void> {
  await api.delete(`/discounts/${id}`);
}
