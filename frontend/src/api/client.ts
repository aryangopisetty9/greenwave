export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error('Unable to connect to the GreenWave server. Check the connection and try again.');
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired or unauthorized');
  }

  if (!response.ok) {
    let errorMessage = `Service unavailable (${response.status}). Please try again.`;
    try {
      const errText = await response.text();
      try {
        const errData = JSON.parse(errText);
        if (errData.detail) {
          errorMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        }
      } catch {
        if (errText && errText.length < 120 && !errText.includes('<!doctype') && !errText.includes('<html')) {
          errorMessage = errText.trim();
        }
      }
    } catch {
      // Stream read failed
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
