import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

const DEFAULT_CONFIG = {
  dockerHost: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock',
  dockerProtocol: 'socket',
  refreshInterval: 5000,
  theme: 'dark',
  language: 'es',
  containerNameFilter: '',
  showStoppedContainers: true,
  logTailLines: 200,
  autoRefresh: true,
  accentColor: '#13b6ec',
  pageSize: 25,
  confirmBeforeRemove: true,
  defaultRestartPolicy: 'unless-stopped',
  savedComposeStacks: [],
  favoriteContainers: [],
  customLabels: {},
};

function ensureDataDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(updates) {
  const current = getConfig();
  const merged = { ...current, ...updates };
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

export function resetConfig() {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return { ...DEFAULT_CONFIG };
}
