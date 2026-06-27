import crypto from 'crypto';

const DEFAULT_USER = process.env.PLUSULTRA_USER || 'plusultra';
const DEFAULT_PASS = process.env.PLUSULTRA_PASS || 'plusultra2026';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sessions = new Map();

function pruneSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}

export function createSession(username) {
  pruneSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

export function validateSession(token) {
  if (!token) return null;
  pruneSessions();
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function verifyCredentials(username, password) {
  return username === DEFAULT_USER && password === DEFAULT_PASS;
}

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-plusultra-token'] || null;
}

export function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const session = validateSession(token);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  req.user = session.username;
  req.authToken = token;
  next();
}

export const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/public-config',
  '/api/auth/background',
];

export function isPublicPath(path) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '?'));
}
