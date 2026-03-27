const BASE_URL = '/api';

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response;
}

export async function getHealth() {
  const response = await fetchWithAuth('/health');
  return response.json();
}

export async function getIceServers(token: string) {
  const response = await fetchWithAuth('/avatar/ice', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function getAvatarConfig() {
  const response = await fetchWithAuth('/avatar/config');
  return response.json();
}

export async function createSession(token: string) {
  const response = await fetchWithAuth('/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}
