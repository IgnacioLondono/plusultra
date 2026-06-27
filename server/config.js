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
  appTitle: 'Plusultra',
  appSubtitle: 'Panel Docker universal',
  backgroundType: 'gradient',
  backgroundColor: '#0f1117',
  backgroundGradient: 'linear-gradient(135deg, #0f1117 0%, #1a1035 50%, #0f1117 100%)',
  backgroundImage: '',
  backgroundVersion: 0,
  backgroundOverlay: 0.35,
  sidebarOpacity: 1,
  panelOpacity: 0.92,
};

export function getPublicConfig(config = getConfig()) {
  return {
    appTitle: config.appTitle,
    appSubtitle: config.appSubtitle,
    theme: config.theme,
    accentColor: config.accentColor,
    backgroundType: config.backgroundType,
    backgroundColor: config.backgroundColor,
    backgroundGradient: config.backgroundGradient,
    backgroundImage: config.backgroundImage,
    backgroundVersion: config.backgroundVersion,
    backgroundOverlay: config.backgroundOverlay,
    sidebarOpacity: config.sidebarOpacity,
    panelOpacity: config.panelOpacity,
  };
}

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
