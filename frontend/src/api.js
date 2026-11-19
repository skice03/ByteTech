import { useEffect, useState } from 'react';

// Override with VITE_API_URL in frontend/.env.local if the API runs elsewhere.
export const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function apiGet(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, { credentials: 'include', signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the ByteTech API. Check that the backend is running.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.error ?? `Request failed (${response.status}).`);
  return body;
}

// Loads `path` and reloads whenever it changes. Pass null to skip loading.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    setState(previous => ({ data: previous.data, error: null, loading: true }));
    apiGet(path, { signal: controller.signal })
      .then(data => setState({ data, error: null, loading: false }))
      .catch(error => { if (error.name !== 'AbortError') setState({ data: null, error, loading: false }); });
    return () => controller.abort();
  }, [path]);
  return state;
}

const priceFormat = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' });
// The API sends exact two-decimal strings; Number() is only used for display formatting.
export const formatPrice = price => priceFormat.format(Number(price));
