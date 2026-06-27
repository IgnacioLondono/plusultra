import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getDocker } from './docker-client.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STACKS_DIR = path.join(__dirname, 'data', 'stacks');

function ensureStacksDir() {
  if (!fs.existsSync(STACKS_DIR)) fs.mkdirSync(STACKS_DIR, { recursive: true });
}

async function runCompose(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      shell: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
  } catch (err) {
    return { ok: false, error: err.stderr || err.message, stdout: err.stdout };
  }
}

export async function listStacks() {
  const docker = getDocker();
  const containers = await docker.listContainers({ all: true });
  const projects = new Map();

  for (const c of containers) {
    const project = c.Labels?.['com.docker.compose.project'];
    if (!project) continue;
    if (!projects.has(project)) {
      projects.set(project, {
        name: project,
        status: 'active',
        services: 0,
        containers: [],
        configFiles: c.Labels?.['com.docker.compose.project.config_files'] || '',
        workingDir: c.Labels?.['com.docker.compose.project.working_dir'] || '',
      });
    }
    const p = projects.get(project);
    p.services = new Set([...p.containers.map((x) => x.service), c.Labels?.['com.docker.compose.service']].filter(Boolean)).size;
    p.containers.push({
      id: c.Id,
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      service: c.Labels?.['com.docker.compose.service'] || '—',
      state: c.State,
      image: c.Image,
    });
    if (c.State !== 'running') p.status = 'partial';
  }

  const saved = listSavedStacks();
  for (const s of saved) {
    if (!projects.has(s.name)) {
      projects.set(s.name, { ...s, status: 'stopped', services: 0, containers: [] });
    }
  }

  try {
    const result = await runCompose('docker compose ls --format json');
    if (result.ok && result.stdout.trim()) {
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const name = item.Name || item.name;
          if (!name) continue;
          const existing = projects.get(name) || {
            name,
            services: 0,
            containers: [],
            configFiles: '',
            workingDir: '',
          };
          existing.status = item.Status?.toLowerCase().includes('running') ? 'active' : existing.status || 'stopped';
          existing.configFiles = item.ConfigFiles || existing.configFiles;
          projects.set(name, existing);
        } catch { /* skip bad line */ }
      }
    }
  } catch { /* compose ls optional */ }

  return Array.from(projects.values()).map((p) => ({
    ...p,
    containerCount: p.containers.length,
    runningCount: p.containers.filter((c) => c.state === 'running').length,
  }));
}

function listSavedStacks() {
  ensureStacksDir();
  const indexPath = path.join(STACKS_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveStackMeta(name, compose) {
  ensureStacksDir();
  const stackDir = path.join(STACKS_DIR, name);
  fs.mkdirSync(stackDir, { recursive: true });
  fs.writeFileSync(path.join(stackDir, 'docker-compose.yml'), compose);

  const indexPath = path.join(STACKS_DIR, 'index.json');
  let index = listSavedStacks();
  const entry = { name, updatedAt: new Date().toISOString() };
  index = index.filter((s) => s.name !== name);
  index.push(entry);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

export function getStackCompose(name) {
  const file = path.join(STACKS_DIR, name, 'docker-compose.yml');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf-8');
}

export async function deployStack(name, compose, options = {}) {
  if (!name?.trim()) throw new Error('Nombre del stack requerido');
  if (!compose?.trim()) throw new Error('Contenido compose requerido');

  const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  saveStackMeta(safeName, compose);

  const composeFile = path.join(STACKS_DIR, safeName, 'docker-compose.yml');
  let cmd = `docker compose -p "${safeName}" -f "${composeFile}" up -d`;
  if (options.pull) cmd += ' --pull always';
  if (options.build) cmd += ' --build';

  const result = await runCompose(cmd);
  if (!result.ok) throw new Error(result.error || 'Error al desplegar stack');
  return { name: safeName, message: 'Stack desplegado correctamente', output: result.stdout };
}

export async function stopStack(name) {
  const composeFile = path.join(STACKS_DIR, name, 'docker-compose.yml');
  let cmd;
  if (fs.existsSync(composeFile)) {
    cmd = `docker compose -p "${name}" -f "${composeFile}" stop`;
  } else {
    cmd = `docker compose -p "${name}" stop`;
  }
  const result = await runCompose(cmd);
  if (!result.ok) throw new Error(result.error || 'Error al detener stack');
  return { message: 'Stack detenido' };
}

export async function startStack(name) {
  const composeFile = path.join(STACKS_DIR, name, 'docker-compose.yml');
  let cmd;
  if (fs.existsSync(composeFile)) {
    cmd = `docker compose -p "${name}" -f "${composeFile}" start`;
  } else {
    cmd = `docker compose -p "${name}" start`;
  }
  const result = await runCompose(cmd);
  if (!result.ok) throw new Error(result.error || 'Error al iniciar stack');
  return { message: 'Stack iniciado' };
}

export async function removeStack(name, options = {}) {
  const composeFile = path.join(STACKS_DIR, name, 'docker-compose.yml');
  let cmd;
  if (fs.existsSync(composeFile)) {
    cmd = `docker compose -p "${name}" -f "${composeFile}" down`;
  } else {
    cmd = `docker compose -p "${name}" down`;
  }
  if (options.volumes) cmd += ' -v';
  if (options.images) cmd += ' --rmi local';

  const result = await runCompose(cmd);
  if (!result.ok) throw new Error(result.error || 'Error al eliminar stack');

  const stackDir = path.join(STACKS_DIR, name);
  if (fs.existsSync(stackDir)) fs.rmSync(stackDir, { recursive: true, force: true });

  const index = listSavedStacks().filter((s) => s.name !== name);
  fs.writeFileSync(path.join(STACKS_DIR, 'index.json'), JSON.stringify(index, null, 2));

  return { message: 'Stack eliminado' };
}

export async function getStackDetail(name) {
  const stacks = await listStacks();
  const stack = stacks.find((s) => s.name === name);
  if (!stack) throw new Error('Stack no encontrado');
  const compose = getStackCompose(name);
  return { ...stack, compose };
}

export const COMPOSE_TEMPLATES = {
  nextcloud: {
    name: 'nextcloud',
    label: 'Nextcloud',
    description: 'Nube personal con MariaDB y Redis',
    compose: `services:
  db:
    image: mariadb:10.11
    restart: unless-stopped
    command: --transaction-isolation=READ-COMMITTED --log-bin=binlog --binlog-format=ROW
    volumes:
      - db_data:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: changeme
      MYSQL_DATABASE: nextcloud
      MYSQL_USER: nextcloud
      MYSQL_PASSWORD: changeme

  redis:
    image: redis:alpine
    restart: unless-stopped

  app:
    image: nextcloud:latest
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - nextcloud_data:/var/www/html
    environment:
      MYSQL_HOST: db
      MYSQL_DATABASE: nextcloud
      MYSQL_USER: nextcloud
      MYSQL_PASSWORD: changeme
      REDIS_HOST: redis
    depends_on:
      - db
      - redis

volumes:
  db_data:
  nextcloud_data:
`,
  },
  nginx: {
    name: 'nginx',
    label: 'Nginx',
    description: 'Servidor web Nginx',
    compose: `services:
  web:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - nginx_html:/usr/share/nginx/html

volumes:
  nginx_html:
`,
  },
  portainer: {
    name: 'portainer',
    label: 'Portainer CE',
    description: 'Gestión Docker visual',
    compose: `services:
  portainer:
    image: portainer/portainer-ce:latest
    restart: unless-stopped
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data

volumes:
  portainer_data:
`,
  },
};

export async function getDockerEvents(since = 3600) {
  const sinceDate = new Date(Date.now() - since * 1000).toISOString();
  return new Promise((resolve) => {
    const events = [];
    const proc = exec(
      `docker events --since "${sinceDate}" --format "{{json .}}"`,
      { shell: true, maxBuffer: 5 * 1024 * 1024 }
    );
    const timer = setTimeout(() => {
      try { proc.kill(); } catch { /* ignore */ }
      resolve(formatEvents(events));
    }, 2500);

    proc.stdout?.on('data', (data) => {
      data.toString().split('\n').filter(Boolean).forEach((line) => {
        try { events.push(JSON.parse(line)); } catch { /* ignore */ }
      });
    });
    proc.on('close', () => {
      clearTimeout(timer);
      resolve(formatEvents(events));
    });
    proc.on('error', () => {
      clearTimeout(timer);
      resolve([]);
    });
  });
}

function formatEvents(raw) {
  return raw.slice(-150).reverse().map((e) => ({
    id: e.id || e.ID || Math.random().toString(36).slice(2),
    type: e.Type || e.type || 'unknown',
    action: e.Action || e.action || e.status || '—',
    actor: e.Actor?.Attributes?.name || e.Actor?.ID?.substring(0, 12) || e.from || '—',
    image: e.Actor?.Attributes?.image || e.from || '',
    time: e.time ? new Date(e.time * 1000).toISOString() : new Date().toISOString(),
  }));
}
