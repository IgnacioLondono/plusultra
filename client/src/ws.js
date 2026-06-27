import { getAuthToken } from './utils/auth';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

function withToken(url) {
  const token = getAuthToken();
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export function getLogsWsUrl(containerId, tail = 200) {
  return withToken(`${WS_BASE}/api/ws/logs?container=${encodeURIComponent(containerId)}&tail=${tail}&timestamps=true`);
}

export function getTerminalWsUrl(containerId, shell = '/bin/bash') {
  return withToken(`${WS_BASE}/api/ws/terminal?container=${encodeURIComponent(containerId)}&shell=${encodeURIComponent(shell)}`);
}
