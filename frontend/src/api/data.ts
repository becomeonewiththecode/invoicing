import api from './client';

/** Triggers a browser download of the current account JSON backup. */
export async function downloadAccountBackup(): Promise<void> {
  const res = await api.get<Blob>('/data/export', { responseType: 'blob' });
  const blob = res.data;
  const cd = res.headers['content-disposition'] as string | undefined;
  let filename = 'invoicing-backup.json';
  const quoted = cd?.match(/filename="([^"]+)"/i);
  const unquoted = cd?.match(/filename=([^;\s]+)/i);
  if (quoted?.[1]) filename = quoted[1].trim();
  else if (unquoted?.[1]) filename = unquoted[1].trim().replace(/^"|"$/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Replace all business data for the logged-in user with a backup file. Destructive. */
export async function importAccountBackup(data: unknown): Promise<void> {
  await api.post('/data/import', { data, confirmReplace: true });
}
