import express from 'express';
import cors from 'cors';
import http from 'http';
import { getConfig, saveConfig, resetConfig, getPublicConfig } from './config.js';
import {
  getDocker,
  resetDockerClient,
  pingDocker,
  formatContainer,
  formatBytes,
} from './docker-client.js';
import { setupWebSockets } from './websockets.js';
import {
  listStacks,
  deployStack,
  stopStack,
  startStack,
  removeStack,
  getStackDetail,
  getStackCompose,
  COMPOSE_TEMPLATES,
  getDockerEvents,
} from './stacks.js';
import { getHostSystemInfo, getLiveHardwareStats } from './host-system.js';
import {
  createSession,
  destroySession,
  verifyCredentials,
  requireAuth,
  getTokenFromRequest,
  validateSession,
  isPublicPath,
} from './auth.js';
import { saveBackground, getBackgroundFile, removeBackground } from './background.js';

const app = express();
const PORT = process.env.PORT || 8675;
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || isPublicPath(req.path)) return next();
  return requireAuth(req, res, next);
});

// ─── Auth ─────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = createSession(username);
  res.json({ token, user: username });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(getTokenFromRequest(req));
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const session = validateSession(getTokenFromRequest(req));
  if (!session) return res.status(401).json({ error: 'No autenticado' });
  res.json({ user: session.username });
});

app.get('/api/auth/public-config', (_req, res) => {
  res.json(getPublicConfig());
});

app.get('/api/auth/background', (_req, res) => {
  const file = getBackgroundFile();
  if (!file) return res.status(404).end();
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(file.filePath);
});

// ─── Config ───────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json(getConfig());
});

app.put('/api/config', (req, res) => {
  const updated = saveConfig(req.body);
  resetDockerClient();
  res.json(updated);
});

app.post('/api/config/background', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Imagen requerida' });
    saveBackground(image);
    const updated = saveConfig({
      backgroundType: 'image',
      backgroundImage: '/api/auth/background',
      backgroundVersion: Date.now(),
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/config/background', (_req, res) => {
  removeBackground();
  const updated = saveConfig({
    backgroundImage: '',
    backgroundType: 'gradient',
    backgroundVersion: Date.now(),
  });
  res.json(updated);
});

app.post('/api/config/reset', (_req, res) => {
  const config = resetConfig();
  resetDockerClient();
  res.json(config);
});

// ─── System / Dashboard ───────────────────────────────────
app.get('/api/system/ping', async (_req, res) => {
  const result = await pingDocker();
  res.json(result);
});

app.get('/api/system/info', async (_req, res) => {
  try {
    const docker = getDocker();
    const [info, version] = await Promise.all([docker.info(), docker.version()]);
    res.json({
      info: {
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        containersPaused: info.ContainersPaused,
        containersStopped: info.ContainersStopped,
        images: info.Images,
        memoryTotal: info.MemTotal,
        memoryTotalFormatted: formatBytes(info.MemTotal),
        cpus: info.NCPU,
        operatingSystem: info.OperatingSystem,
        architecture: info.Architecture,
        dockerRootDir: info.DockerRootDir,
        serverVersion: info.ServerVersion,
        name: info.Name,
      },
      version,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/host', async (_req, res) => {
  try {
    res.json(await getHostSystemInfo());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/host/live', async (_req, res) => {
  try {
    res.json(await getLiveHardwareStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/stats', async (_req, res) => {
  try {
    const docker = getDocker();
    const containers = await docker.listContainers({ all: true });
    const images = await docker.listImages();
    let totalSize = 0;
    images.forEach((img) => {
      totalSize += img.Size || 0;
    });

    const running = containers.filter((c) => c.State === 'running').length;
    const stopped = containers.filter((c) => c.State !== 'running').length;

    res.json({
      containers: { total: containers.length, running, stopped },
      images: { total: images.length, totalSize, totalSizeFormatted: formatBytes(totalSize) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Containers ───────────────────────────────────────────
app.get('/api/containers', async (req, res) => {
  try {
    const docker = getDocker();
    const config = getConfig();
    const all = req.query.all !== 'false' && config.showStoppedContainers;
    const containers = await docker.listContainers({ all });
    let formatted = containers.map(formatContainer);

    if (config.containerNameFilter) {
      const filter = config.containerNameFilter.toLowerCase();
      formatted = formatted.filter(
        (c) =>
          c.name.toLowerCase().includes(filter) ||
          c.image.toLowerCase().includes(filter)
      );
    }

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/containers/:id', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    const [inspect, stats] = await Promise.all([
      container.inspect(),
      container.stats({ stream: false }).catch(() => null),
    ]);

    let cpuPercent = 0;
    let memUsage = 0;
    let memLimit = 0;
    let memPercent = 0;

    if (stats) {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
      const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      if (systemDelta > 0) cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100;

      memUsage = stats.memory_stats.usage || 0;
      memLimit = stats.memory_stats.limit || 1;
      memPercent = (memUsage / memLimit) * 100;
    }

    res.json({
      inspect,
      stats: stats
        ? {
            cpuPercent: cpuPercent.toFixed(2),
            memUsage,
            memUsageFormatted: formatBytes(memUsage),
            memLimit,
            memLimitFormatted: formatBytes(memLimit),
            memPercent: memPercent.toFixed(2),
            networkRx: stats.networks ? Object.values(stats.networks).reduce((a, n) => a + (n.rx_bytes || 0), 0) : 0,
            networkTx: stats.networks ? Object.values(stats.networks).reduce((a, n) => a + (n.tx_bytes || 0), 0) : 0,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/start', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true, message: 'Contenedor iniciado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/stop', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    await container.stop({ t: req.body.timeout || 10 });
    res.json({ success: true, message: 'Contenedor detenido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/restart', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    await container.restart({ t: req.body.timeout || 10 });
    res.json({ success: true, message: 'Contenedor reiniciado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/pause', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    await container.pause();
    res.json({ success: true, message: 'Contenedor pausado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/unpause', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    await container.unpause();
    res.json({ success: true, message: 'Contenedor reanudado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/containers/:id', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    if (req.query.force === 'true') {
      await container.remove({ force: true, v: req.query.volumes === 'true' });
    } else {
      await container.remove({ v: req.query.volumes === 'true' });
    }
    res.json({ success: true, message: 'Contenedor eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/containers/:id/logs', async (req, res) => {
  try {
    const docker = getDocker();
    const config = getConfig();
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(req.query.tail) || config.logTailLines,
      timestamps: true,
    });
    const text = logs.toString('utf-8');
    res.json({ logs: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/containers/:id/rename', async (req, res) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(req.params.id);
    await container.rename({ name: req.body.name });
    res.json({ success: true, message: 'Contenedor renombrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/create', async (req, res) => {
  try {
    const docker = getDocker();
    const config = getConfig();
    const {
      image,
      name,
      env = [],
      ports = {},
      volumes = [],
      cmd,
      labels = {},
      restartPolicy = config.defaultRestartPolicy,
      networkMode = 'bridge',
    } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'La imagen es obligatoria' });
    }

    const ExposedPorts = {};
    const PortBindings = {};
    for (const [containerPort, hostPort] of Object.entries(ports)) {
      const portKey = containerPort.includes('/') ? containerPort : `${containerPort}/tcp`;
      ExposedPorts[portKey] = {};
      PortBindings[portKey] = [{ HostPort: String(hostPort) }];
    }

    const Binds = volumes.map((v) =>
      typeof v === 'string' ? v : `${v.source}:${v.destination}${v.readOnly ? ':ro' : ''}`
    );

    const mergedLabels = { ...config.customLabels, ...labels, 'plusultra.managed': 'true' };

    const container = await docker.createContainer({
      Image: image,
      name: name || undefined,
      Env: Array.isArray(env) ? env : [],
      ExposedPorts: Object.keys(ExposedPorts).length ? ExposedPorts : undefined,
      HostConfig: {
        PortBindings: Object.keys(PortBindings).length ? PortBindings : undefined,
        Binds: Binds.length ? Binds : undefined,
        RestartPolicy: { Name: restartPolicy },
        NetworkMode: networkMode,
      },
      Cmd: cmd ? (Array.isArray(cmd) ? cmd : cmd.split(' ')) : undefined,
      Labels: mergedLabels,
    });

    if (req.body.autoStart !== false) {
      await container.start();
    }

    const inspect = await container.inspect();
    res.json({ success: true, container: inspect });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/recreate', async (req, res) => {
  try {
    const docker = getDocker();
    const oldContainer = docker.getContainer(req.params.id);
    const inspect = await oldContainer.inspect();

    const updates = req.body || {};
    const config = inspect.Config;
    const hostConfig = { ...inspect.HostConfig };

    if (updates.ports && typeof updates.ports === 'object') {
      const ExposedPorts = {};
      const PortBindings = {};
      for (const [containerPort, hostPort] of Object.entries(updates.ports)) {
        const portKey = containerPort.includes('/') ? containerPort : `${containerPort}/tcp`;
        ExposedPorts[portKey] = {};
        PortBindings[portKey] = [{ HostPort: String(hostPort) }];
      }
      config.ExposedPorts = ExposedPorts;
      hostConfig.PortBindings = PortBindings;
    }

    if (updates.memoryLimit != null) hostConfig.Memory = parseInt(updates.memoryLimit) || 0;
    if (updates.memorySwap != null) hostConfig.MemorySwap = parseInt(updates.memorySwap) || 0;
    if (updates.cpuShares != null) hostConfig.CpuShares = parseInt(updates.cpuShares) || 0;
    if (updates.networkMode) hostConfig.NetworkMode = updates.networkMode;

    await oldContainer.stop({ t: 5 }).catch(() => {});
    await oldContainer.remove({ force: true });

    const newConfig = {
      Image: updates.image || config.Image,
      name: updates.name || inspect.Name.replace(/^\//, ''),
      Env: updates.env || config.Env,
      ExposedPorts: config.ExposedPorts,
      HostConfig: {
        ...hostConfig,
        RestartPolicy: updates.restartPolicy
          ? { Name: updates.restartPolicy }
          : hostConfig.RestartPolicy,
        Binds: updates.volumes || hostConfig.Binds,
      },
      Cmd: updates.cmd ? (Array.isArray(updates.cmd) ? updates.cmd : updates.cmd.split(' ')) : config.Cmd,
      Labels: { ...config.Labels, ...updates.labels },
    };

    const container = await docker.createContainer(newConfig);
    await container.start();
    const newInspect = await container.inspect();
    res.json({ success: true, container: newInspect });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Images ───────────────────────────────────────────────
app.get('/api/images', async (_req, res) => {
  try {
    const docker = getDocker();
    const images = await docker.listImages({ all: true });
    const formatted = images.map((img) => ({
      id: img.Id,
      shortId: img.Id.replace('sha256:', '').substring(0, 12),
      tags: img.RepoTags || ['<sin tag>'],
      created: img.Created,
      size: img.Size,
      sizeFormatted: formatBytes(img.Size),
      virtualSize: img.VirtualSize,
      virtualSizeFormatted: formatBytes(img.VirtualSize),
      labels: img.Labels || {},
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images/pull', async (req, res) => {
  try {
    const docker = getDocker();
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Nombre de imagen requerido' });

    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });
    });

    res.json({ success: true, message: `Imagen ${image} descargada` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/images/:id', async (req, res) => {
  try {
    const docker = getDocker();
    const image = docker.getImage(req.params.id);
    await image.remove({ force: req.query.force === 'true' });
    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Volumes ──────────────────────────────────────────────
app.get('/api/volumes', async (_req, res) => {
  try {
    const docker = getDocker();
    const result = await docker.listVolumes();
    const volumes = (result.Volumes || []).map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      createdAt: v.CreatedAt,
      labels: v.Labels || {},
      scope: v.Scope,
    }));
    res.json(volumes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/volumes', async (req, res) => {
  try {
    const docker = getDocker();
    const { name, driver = 'local', labels = {} } = req.body;
    const volume = await docker.createVolume({ Name: name, Driver: driver, Labels: labels });
    res.json({ success: true, volume: volume });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/volumes/:name', async (req, res) => {
  try {
    const docker = getDocker();
    const volume = docker.getVolume(req.params.name);
    await volume.remove({ force: req.query.force === 'true' });
    res.json({ success: true, message: 'Volumen eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Networks ─────────────────────────────────────────────
app.get('/api/networks', async (_req, res) => {
  try {
    const docker = getDocker();
    const networks = await docker.listNetworks();
    const formatted = networks.map((n) => ({
      id: n.Id,
      shortId: n.Id.substring(0, 12),
      name: n.Name,
      driver: n.Driver,
      scope: n.Scope,
      internal: n.Internal,
      attachable: n.Attachable,
      containers: Object.keys(n.Containers || {}).length,
      labels: n.Labels || {},
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/networks', async (req, res) => {
  try {
    const docker = getDocker();
    const { name, driver = 'bridge', internal = false, attachable = true, labels = {} } = req.body;
    const network = await docker.createNetwork({ Name: name, Driver: driver, Internal: internal, Attachable: attachable, Labels: labels });
    res.json({ success: true, network });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/networks/:id', async (req, res) => {
  try {
    const docker = getDocker();
    const network = docker.getNetwork(req.params.id);
    await network.remove();
    res.json({ success: true, message: 'Red eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Bulk actions ─────────────────────────────────────────
app.post('/api/containers/bulk', async (req, res) => {
  try {
    const docker = getDocker();
    const { ids, action } = req.body;
    if (!ids?.length || !action) {
      return res.status(400).json({ error: 'ids y action son requeridos' });
    }

    const results = [];
    for (const id of ids) {
      const container = docker.getContainer(id);
      try {
        switch (action) {
          case 'start': await container.start(); break;
          case 'stop': await container.stop({ t: 10 }); break;
          case 'restart': await container.restart({ t: 10 }); break;
          case 'remove': await container.remove({ force: true }); break;
          default: throw new Error(`Acción desconocida: ${action}`);
        }
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stacks (Compose) ─────────────────────────────────────
app.get('/api/stacks', async (_req, res) => {
  try {
    res.json(await listStacks());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stacks/templates', (_req, res) => {
  res.json(COMPOSE_TEMPLATES);
});

app.get('/api/stacks/:name', async (req, res) => {
  try {
    res.json(await getStackDetail(req.params.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stacks/:name/compose', (req, res) => {
  const compose = getStackCompose(req.params.name);
  if (!compose) return res.status(404).json({ error: 'Compose no encontrado' });
  res.json({ compose });
});

app.post('/api/stacks/deploy', async (req, res) => {
  try {
    const { name, compose, pull, build } = req.body;
    const result = await deployStack(name, compose, { pull, build });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stacks/:name/start', async (req, res) => {
  try {
    res.json(await startStack(req.params.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stacks/:name/stop', async (req, res) => {
  try {
    res.json(await stopStack(req.params.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stacks/:name', async (req, res) => {
  try {
    res.json(await removeStack(req.params.name, {
      volumes: req.query.volumes === 'true',
      images: req.query.images === 'true',
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Events ───────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  try {
    const since = parseInt(req.query.since) || 3600;
    res.json(await getDockerEvents(since));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend in production
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

setupWebSockets(server);

server.listen(PORT, () => {
  console.log(`⚡ Plusultra API corriendo en http://localhost:${PORT}`);
});
