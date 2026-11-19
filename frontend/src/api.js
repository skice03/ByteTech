import { useEffect, useState } from 'react';

// Override with VITE_API_URL in frontend/.env.local if the API runs elsewhere.
export const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...options, credentials: 'include' });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the ByteTech API. Check that the backend is running.');
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/users/me') {
      window.dispatchEvent(new Event('bytetech-session-expired'));
    }
    const details = body.fields ? Object.values(body.fields).join(' ') : '';
    throw new ApiError(response.status, [body.error ?? `Request failed (${response.status}).`, details].filter(Boolean).join(' '));
  }
  return body;
}

export async function apiWrite(method, path, data) {
  const { csrfToken } = await apiRequest('/auth/csrf');
  return apiRequest(path, {
    method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(data)
  });
}

export function useApi(path) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    apiRequest(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ path, data, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState({ path, data: null, error }); });
    return () => controller.abort();
  }, [path]);
  const current = state?.path === path ? state : null;
  return {
    data: current?.data, error: current?.error, loading: Boolean(path && !current),
    replaceData: data => setState({ path, data, error: null })
  };
}

const priceFormat = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' });
// The API sends exact two-decimal strings; Number() is only used for display formatting.
export const formatPrice = price => priceFormat.format(Number(price));
