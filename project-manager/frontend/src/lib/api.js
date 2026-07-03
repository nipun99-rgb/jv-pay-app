const BASE = '/api';

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  // Remove Content-Type for FormData (browser sets multipart boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers
  });

  if (res.status === 401) {
    // Don't redirect if already on login page or if this is the /auth/me check
    if (!window.location.pathname.startsWith('/login') && !path.endsWith('/auth/me')) {
      window.location.href = '/login';
    }
    const err = await res.json().catch(() => ({ error: 'Unauthorized' }));
    throw new Error(err.error || 'Unauthorized');
  }

  if (res.status === 503) {
    const err = await res.json().catch(() => ({ error: 'Service unavailable' }));
    throw new Error(err.error || 'Database unavailable');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
