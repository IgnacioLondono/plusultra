import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BG_DIR = path.join(__dirname, 'data', 'backgrounds');

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function ensureBgDir() {
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
}

export function saveBackground(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new Error('Formato de imagen no válido (PNG, JPG, WebP o GIF)');

  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error('Tipo de imagen no soportado');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('La imagen no puede superar 5 MB');
  }

  ensureBgDir();
  for (const file of fs.readdirSync(BG_DIR)) {
    fs.unlinkSync(path.join(BG_DIR, file));
  }

  const filePath = path.join(BG_DIR, `bg.${ext}`);
  fs.writeFileSync(filePath, buffer);
  return { filePath, mime, ext };
}

export function getBackgroundFile() {
  ensureBgDir();
  const file = fs.readdirSync(BG_DIR).find((f) => f.startsWith('bg.'));
  if (!file) return null;
  const filePath = path.join(BG_DIR, file);
  const ext = path.extname(file).slice(1);
  const mime = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] || 'image/jpeg';
  return { filePath, mime };
}

export function removeBackground() {
  ensureBgDir();
  for (const file of fs.readdirSync(BG_DIR)) {
    fs.unlinkSync(path.join(BG_DIR, file));
  }
}
