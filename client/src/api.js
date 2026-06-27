import { getAuthToken, setAuthToken } from './utils/auth.js';

const API = '/api';

export async function fetchJSON(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${url}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/auth/')) {
    setAuthToken(null);
    window.dispatchEvent(new Event('plusultra:logout'));
  }
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

export const api = {
  login: (username, password) =>
    fetchJSON('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => fetchJSON('/auth/logout', { method: 'POST' }).catch(() => {}),
  me: () => fetchJSON('/auth/me'),
  getPublicConfig: () => fetchJSON('/auth/public-config'),

  getConfig: () => fetchJSON('/config'),
  saveConfig: (cfg) => fetchJSON('/config', { method: 'PUT', body: JSON.stringify(cfg) }),
  uploadBackground: (image) =>
    fetchJSON('/config/background', { method: 'POST', body: JSON.stringify({ image }) }),
  removeBackground: () => fetchJSON('/config/background', { method: 'DELETE' }),
  resetConfig: () => fetchJSON('/config/reset', { method: 'POST' }),

  ping: () => fetchJSON('/system/ping'),
  getInfo: () => fetchJSON('/system/info'),
  getHostSystem: () => fetchJSON('/system/host'),
  getHostLive: () => fetchJSON('/system/host/live'),
  getStats: () => fetchJSON('/system/stats'),

  getContainers: () => fetchJSON('/containers'),
  getContainer: (id) => fetchJSON(`/containers/${id}`),
  startContainer: (id) => fetchJSON(`/containers/${id}/start`, { method: 'POST' }),
  stopContainer: (id) => fetchJSON(`/containers/${id}/stop`, { method: 'POST' }),
  restartContainer: (id) => fetchJSON(`/containers/${id}/restart`, { method: 'POST' }),
  pauseContainer: (id) => fetchJSON(`/containers/${id}/pause`, { method: 'POST' }),
  unpauseContainer: (id) => fetchJSON(`/containers/${id}/unpause`, { method: 'POST' }),
  removeContainer: (id, force = true, volumes = false) =>
    fetchJSON(`/containers/${id}?force=${force}&volumes=${volumes}`, { method: 'DELETE' }),
  getLogs: (id, tail) => fetchJSON(`/containers/${id}/logs?tail=${tail || 200}`),
  renameContainer: (id, name) =>
    fetchJSON(`/containers/${id}/rename`, { method: 'PUT', body: JSON.stringify({ name }) }),
  createContainer: (body) =>
    fetchJSON('/containers/create', { method: 'POST', body: JSON.stringify(body) }),
  recreateContainer: (id, body) =>
    fetchJSON(`/containers/${id}/recreate`, { method: 'POST', body: JSON.stringify(body) }),
  bulkAction: (ids, action) =>
    fetchJSON('/containers/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),

  getImages: () => fetchJSON('/images'),
  pullImage: (image) => fetchJSON('/images/pull', { method: 'POST', body: JSON.stringify({ image }) }),
  removeImage: (id, force = false) =>
    fetchJSON(`/images/${encodeURIComponent(id)}?force=${force}`, { method: 'DELETE' }),

  getVolumes: () => fetchJSON('/volumes'),
  createVolume: (body) => fetchJSON('/volumes', { method: 'POST', body: JSON.stringify(body) }),
  removeVolume: (name, force = false) =>
    fetchJSON(`/volumes/${name}?force=${force}`, { method: 'DELETE' }),

  getNetworks: () => fetchJSON('/networks'),
  createNetwork: (body) => fetchJSON('/networks', { method: 'POST', body: JSON.stringify(body) }),
  removeNetwork: (id) => fetchJSON(`/networks/${id}`, { method: 'DELETE' }),

  getStacks: () => fetchJSON('/stacks'),
  getStackTemplates: () => fetchJSON('/stacks/templates'),
  getStack: (name) => fetchJSON(`/stacks/${name}`),
  getStackCompose: (name) => fetchJSON(`/stacks/${name}/compose`),
  deployStack: (body) => fetchJSON('/stacks/deploy', { method: 'POST', body: JSON.stringify(body) }),
  startStack: (name) => fetchJSON(`/stacks/${name}/start`, { method: 'POST' }),
  stopStack: (name) => fetchJSON(`/stacks/${name}/stop`, { method: 'POST' }),
  removeStack: (name, volumes = false, images = false) =>
    fetchJSON(`/stacks/${name}?volumes=${volumes}&images=${images}`, { method: 'DELETE' }),

  getEvents: (since = 3600) => fetchJSON(`/events?since=${since}`),
};
