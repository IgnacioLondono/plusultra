import { WebSocketServer } from 'ws';
import { getDocker } from './docker-client.js';
import { validateSession } from './auth.js';

/**
 * Demultiplex Docker log stream (8-byte header per frame).
 */
export function demuxDockerStream(chunk) {
  let offset = 0;
  let result = '';
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

  while (offset < buf.length) {
    if (offset + 8 > buf.length) {
      result += buf.slice(offset).toString('utf8');
      break;
    }
    const size = buf.readUInt32BE(offset + 4);
    if (offset + 8 + size > buf.length) {
      result += buf.slice(offset + 8).toString('utf8');
      break;
    }
    result += buf.slice(offset + 8, offset + 8 + size).toString('utf8');
    offset += 8 + size;
  }
  return result;
}

export function setupWebSockets(server) {
  const terminalWss = new WebSocketServer({ noServer: true });
  const logsWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const { pathname } = url;

    const token = url.searchParams.get('token')
      || request.headers['sec-websocket-protocol']?.split(',')[0]?.trim();
    if (!validateSession(token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    if (pathname === '/api/ws/terminal') {
      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        terminalWss.emit('connection', ws, request, url);
      });
    } else if (pathname === '/api/ws/logs') {
      logsWss.handleUpgrade(request, socket, head, (ws) => {
        logsWss.emit('connection', ws, request, url);
      });
    } else {
      socket.destroy();
    }
  });

  terminalWss.on('connection', async (ws, _req, url) => {
    const containerId = url.searchParams.get('container');
    const shell = url.searchParams.get('shell') || '/bin/sh';
    let stream = null;
    let execInstance = null;
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      try { stream?.destroy?.(); } catch { /* ignore */ }
      try { if (ws.readyState === 1) ws.close(); } catch { /* ignore */ }
    };

    if (!containerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'container id requerido' }));
      ws.close();
      return;
    }

    try {
      const docker = getDocker();
      const container = docker.getContainer(containerId);
      const inspect = await container.inspect();

      if (inspect.State?.Status !== 'running') {
        ws.send(JSON.stringify({ type: 'error', message: 'El contenedor no está en ejecución' }));
        ws.close();
        return;
      }

      execInstance = await container.exec({
        Cmd: shell.includes(' ') ? shell.split(' ') : [shell],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: ['TERM=xterm-256color'],
      });

      stream = await execInstance.start({ hijack: true, stdin: true, Tty: true });

      ws.send(JSON.stringify({
        type: 'connected',
        container: inspect.Name?.replace(/^\//, '') || containerId,
        shell,
      }));

      stream.on('data', (chunk) => {
        if (ws.readyState === 1) ws.send(chunk);
      });
      stream.on('end', cleanup);
      stream.on('close', cleanup);
      stream.on('error', () => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'error', message: 'Error en el stream de la terminal' }));
        }
        cleanup();
      });

      ws.on('message', (data) => {
        if (!stream || closed) return;
        try {
          const text = data.toString();
          if (text.startsWith('{"type":"resize"')) {
            const { cols, rows } = JSON.parse(text);
            execInstance.resize({ w: cols, h: rows }).catch(() => {});
            return;
          }
          stream.write(data);
        } catch { /* ignore */ }
      });

      ws.on('close', cleanup);
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
      cleanup();
    }
  });

  logsWss.on('connection', async (ws, _req, url) => {
    const containerId = url.searchParams.get('container');
    const tail = parseInt(url.searchParams.get('tail') || '200', 10);
    const timestamps = url.searchParams.get('timestamps') !== 'false';
    let logStream = null;
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      try { logStream?.destroy?.(); } catch { /* ignore */ }
      try { if (ws.readyState === 1) ws.close(); } catch { /* ignore */ }
    };

    if (!containerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'container id requerido' }));
      ws.close();
      return;
    }

    try {
      const docker = getDocker();
      const container = docker.getContainer(containerId);
      const inspect = await container.inspect();

      ws.send(JSON.stringify({
        type: 'connected',
        container: inspect.Name?.replace(/^\//, '') || containerId,
      }));

      logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail,
        timestamps,
      });

      logStream.on('data', (chunk) => {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({ type: 'log', data: demuxDockerStream(chunk) }));
      });

      logStream.on('end', () => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'end', message: 'Stream de logs finalizado' }));
        }
        cleanup();
      });

      logStream.on('error', (err) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
        cleanup();
      });

      ws.on('close', cleanup);
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
      cleanup();
    }
  });

  console.log('🔌 WebSockets: /api/ws/terminal · /api/ws/logs');
}
