import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function mapDisk({ mount, label, filesystem, total, free }) {
  const used = total - free;
  const usedPercent = total > 0 ? ((used / total) * 100).toFixed(1) : '0';
  return {
    mount,
    label: label || mount,
    filesystem: filesystem || '—',
    total,
    free,
    used,
    usedPercent,
    totalFormatted: formatBytes(total),
    usedFormatted: formatBytes(used),
    freeFormatted: formatBytes(free),
  };
}

async function getWindowsDisks() {
  const { stdout } = await execAsync(
    'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk -Filter \'DriveType=3\' | Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace | ConvertTo-Json"',
    { maxBuffer: 5 * 1024 * 1024, shell: true }
  );
  let data = JSON.parse(stdout.trim() || '[]');
  if (!Array.isArray(data)) data = data ? [data] : [];
  return data
    .filter((d) => d.Size > 0)
    .map((d) =>
      mapDisk({
        mount: d.DeviceID,
        label: d.VolumeName ? `${d.DeviceID} (${d.VolumeName})` : d.DeviceID,
        filesystem: d.FileSystem,
        total: Number(d.Size),
        free: Number(d.FreeSpace),
      })
    );
}

async function getUnixDisks() {
  const { stdout } = await execAsync('df -kP', { maxBuffer: 5 * 1024 * 1024 });
  const lines = stdout.trim().split('\n').slice(1);
  const disks = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const total = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const free = parseInt(parts[3], 10) * 1024;
    const mount = parts.slice(5).join(' ');
    if (total <= 0) continue;
    disks.push(
      mapDisk({
        mount,
        label: mount,
        filesystem: parts[0],
        total,
        free,
      })
    );
  }
  return disks;
}

async function getDiskUsage() {
  try {
    if (process.platform === 'win32') return await getWindowsDisks();
    return await getUnixDisks();
  } catch {
    return [];
  }
}

async function getDockerDiskUsage() {
  try {
    const { stdout } = await execAsync('docker system df --format "{{json .}}"', {
      shell: true,
      maxBuffer: 5 * 1024 * 1024,
    });
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          const row = JSON.parse(line);
          return {
            type: row.Type,
            total: row.Size,
            active: row.Active,
            reclaimable: row.Reclaimable,
            totalCount: row.TotalCount,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

export async function getHostSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const [disks, dockerDisk, gpus] = await Promise.all([
    getDiskUsage(),
    getDockerDiskUsage(),
    getGpuStaticInfo(),
  ]);

  return {
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
      uptime: os.uptime(),
      uptimeFormatted: formatUptime(os.uptime()),
      nodeVersion: process.version,
      osLabel: `${os.type()} ${os.release()} (${os.arch()})`,
      loadAvg: os.loadavg(),
    },
    cpu: {
      model: cpus[0]?.model?.trim() || 'Desconocido',
      cores: cpus.length,
      speed: cpus[0]?.speed ? `${cpus[0].speed} MHz` : '—',
      arch: os.arch(),
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usedPercent: ((usedMem / totalMem) * 100).toFixed(1),
      totalFormatted: formatBytes(totalMem),
      usedFormatted: formatBytes(usedMem),
      freeFormatted: formatBytes(freeMem),
    },
    disks,
    dockerDisk,
    gpus,
  };
}

function cpuTimesSnapshot() {
  return os.cpus().map((cpu) => ({ ...cpu.times }));
}

function calcCoreUsage(prev, curr) {
  return prev.map((p, i) => {
    const c = curr[i];
    let idle = c.idle - p.idle;
    let total = 0;
    for (const key of Object.keys(c)) {
      total += c[key] - p[key];
    }
    const usage = total > 0 ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : 0;
    return {
      core: i + 1,
      usage: usage.toFixed(1),
      speed: os.cpus()[i]?.speed || 0,
    };
  });
}

export async function getCpuCoreUsage() {
  const prev = cpuTimesSnapshot();
  await new Promise((r) => setTimeout(r, 400));
  const curr = cpuTimesSnapshot();
  const cores = calcCoreUsage(prev, curr);
  const overall = (
    cores.reduce((acc, c) => acc + parseFloat(c.usage), 0) / (cores.length || 1)
  ).toFixed(1);
  return { cores, overall };
}

async function getGpuStaticInfo() {
  const gpus = [];
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, VideoProcessor, Status | ConvertTo-Json"',
        { shell: true, maxBuffer: 5 * 1024 * 1024 }
      );
      let data = JSON.parse(stdout.trim() || '[]');
      if (!Array.isArray(data)) data = data ? [data] : [];
      data.forEach((g, i) => {
        if (!g.Name) return;
        gpus.push({
          index: i,
          name: g.Name,
          vram: g.AdapterRAM ? formatBytes(Number(g.AdapterRAM)) : '—',
          vramBytes: Number(g.AdapterRAM) || 0,
          driver: g.DriverVersion || '—',
          processor: g.VideoProcessor || '—',
          status: g.Status || '—',
          vendor: detectVendor(g.Name),
        });
      });
    } else {
      const { stdout } = await execAsync(
        'lspci 2>/dev/null | grep -iE "vga|3d|display" || true',
        { shell: true }
      );
      stdout.trim().split('\n').filter(Boolean).forEach((line, i) => {
        const name = line.replace(/^[^:]+:\s*/, '').trim();
        gpus.push({ index: i, name, vendor: detectVendor(name), driver: '—', vram: '—' });
      });
    }
  } catch { /* ignore */ }
  return gpus.filter((g) => g.name && !g.name.toLowerCase().includes('microsoft basic'));
}

function detectVendor(name = '') {
  const n = name.toLowerCase();
  if (n.includes('nvidia')) return 'NVIDIA';
  if (n.includes('amd') || n.includes('radeon')) return 'AMD';
  if (n.includes('intel')) return 'Intel';
  return 'Otro';
}

async function getNvidiaLiveStats() {
  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=index,name,driver_version,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu,power.draw,fan.speed --format=csv,noheader,nounits',
      { shell: true, timeout: 5000 }
    );
    return stdout.trim().split('\n').filter(Boolean).map((line) => {
      const p = line.split(',').map((s) => s.trim());
      return {
        index: parseInt(p[0], 10),
        name: p[1],
        driver: p[2],
        memTotal: `${p[3]} MiB`,
        memUsed: `${p[4]} MiB`,
        memFree: `${p[5]} MiB`,
        gpuUtil: `${p[6]}%`,
        memUtil: `${p[7]}%`,
        temperature: p[8] ? `${p[8]}°C` : '—',
        power: p[9] ? `${p[9]} W` : '—',
        fan: p[10] ? `${p[10]}%` : '—',
        vendor: 'NVIDIA',
      };
    });
  } catch {
    return [];
  }
}

export async function getLiveHardwareStats() {
  const [cpu, nvidiaGpus] = await Promise.all([
    getCpuCoreUsage(),
    getNvidiaLiveStats(),
  ]);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let gpus = nvidiaGpus;
  if (!gpus.length) {
    gpus = await getGpuStaticInfo();
  }

  return {
    cpu,
    memory: {
      usedPercent: ((usedMem / totalMem) * 100).toFixed(1),
      usedFormatted: formatBytes(usedMem),
      freeFormatted: formatBytes(freeMem),
      totalFormatted: formatBytes(totalMem),
    },
    gpus,
    loadAvg: os.loadavg(),
    timestamp: Date.now(),
  };
}
