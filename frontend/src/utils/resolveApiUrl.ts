/** Turn a relative API path (e.g. /api/uploads/...) into an absolute URL for <img>, fetch, or PDF embedding. */
export function resolveApiAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  const p = pathOrUrl.trim();
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
  const origin = base.replace(/\/api\/?$/, '');
  return p.startsWith('/') ? `${origin}${p}` : `${origin}/${p}`;
}
