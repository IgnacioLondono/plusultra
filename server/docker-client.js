import Docker from 'dockerode';
import { getConfig } from './config.js';

let dockerInstance = null;
let lastHost = null;

export function getDocker() {
  const config = getConfig();
  const host = config.dockerHost;

  if (dockerInstance && lastHost === host) {
    return dockerInstance;
  }

  if (config.dockerProtocol === 'http' || config.dockerProtocol === 'https') {
    dockerInstance = new Docker({ host: host, protocol: config.dockerProtocol });
  } else {
    dockerInstance = new Docker({ socketPath: host });
  }

  lastHost = host;
  return dockerInstance;
}

export function resetDockerClient() {
  dockerInstance = null;
  lastHost = null;
}

export async function pingDocker() {
  try {
    const docker = getDocker();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: Docker no respondió en 5s')), 5000)
    );
    await Promise.race([docker.ping(), timeout]);
    const info = await Promise.race([
      docker.info(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout obteniendo info')), 5000)),
    ]);
    return { ok: true, info };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function formatContainer(container) {
  const names = (container.Names || []).map((n) => n.replace(/^\//, ''));
  const ports = (container.Ports || [])
    .filter((p) => p.PublicPort)
    .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
    .join(', ');

  return {
    id: container.Id,
    shortId: container.Id?.substring(0, 12),
    names,
    name: names[0] || container.Id?.substring(0, 12),
    image: container.Image,
    state: container.State,
    status: container.Status,
    created: container.Created,
    ports: ports || '—',
    labels: container.Labels || {},
    networkMode: container.HostConfig?.NetworkMode || '—',
    mounts: (container.Mounts || []).map((m) => ({
      type: m.Type,
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
    })),
  };
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
