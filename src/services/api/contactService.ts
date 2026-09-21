import type { ApiResponse, ContactMessage } from '@/types';
import { apiClient, mockDelay, USE_MOCK } from './client';

export async function sendContactMessage(payload: ContactMessage): Promise<{ ticketId: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ ticketId: string }>>('/contact', payload);
    return data.data;
  }
  return mockDelay({ ticketId: `TD-${Date.now().toString(36).toUpperCase()}` }, 800);
}

export async function subscribeNewsletter(email: string): Promise<{ email: string }> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<{ email: string }>>('/newsletter', {
      email,
    });
    return data.data;
  }
  return mockDelay({ email }, 600);
}
