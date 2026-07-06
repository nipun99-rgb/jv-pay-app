/**
 * Thin fetch wrapper for the API gateway.
 * Sends JSON, returns JSON. Throws on non-2xx responses.
 */
const BASE_URL = '/api';

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(body) as { error?: { message?: string } };
      message = json?.error?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as unknown) : null;
}
