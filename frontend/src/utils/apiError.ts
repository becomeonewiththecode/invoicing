import axios from 'axios';

/** Reads `error` or `message` from a typical API JSON error body. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
    const data = err.response.data as { error?: unknown; message?: unknown };
    if (typeof data.error === 'string' && data.error.length > 0) return data.error;
    if (typeof data.message === 'string' && data.message.length > 0) return data.message;
  }
  return fallback;
}
