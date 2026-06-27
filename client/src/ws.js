const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export function getLogsWsUrl(containerId, tail = 200) {
  return `${WS_BASE}/api/ws/logs?container=${encodeURIComponent(containerId)}&tail=${tail}&timestamps=true`;
}

export function getTerminalWsUrl(containerId, shell = '/bin/bash') {
  return `${WS_BASE}/api/ws/terminal?container=${encodeURIComponent(containerId)}&shell=${encodeURIComponent(shell)}`;
}
