import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '../api';
import { getTerminalWsUrl } from '../ws';

const SHELLS = [
  { label: 'Bash', value: '/bin/bash' },
  { label: 'Sh', value: '/bin/sh' },
  { label: 'Ash (Alpine)', value: '/bin/ash' },
];

export default function Terminal({ connected, addToast, initialContainer, onClearTarget }) {
  const [containers, setContainers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [shell, setShell] = useState('/bin/bash');
  const [connectedTerm, setConnectedTerm] = useState(false);
  const [status, setStatus] = useState('idle');

  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  const loadContainers = useCallback(async () => {
    if (!connected) return;
    try {
      const data = await api.getContainers();
      const running = data.filter((c) => c.state === 'running');
      setContainers(running);
      if (!selected && running.length > 0) setSelected(running[0].id);
    } catch (e) {
      addToast(e.message, 'error');
    }
  }, [connected, addToast, selected]);

  useEffect(() => { loadContainers(); }, [loadContainers]);

  useEffect(() => {
    if (initialContainer) {
      setSelected(initialContainer);
      onClearTarget?.();
    }
  }, [initialContainer, onClearTarget]);

  useEffect(() => {
    if (!termRef.current || xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: '#0d0d14',
        foreground: '#e2e2f0',
        cursor: '#6366f1',
        selectionBackground: '#6366f144',
        black: '#1a1a26',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f0f0f5',
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);
    fit.fit();

    term.writeln('\x1b[1;35m⚡ Plusultra Terminal\x1b[0m');
    term.writeln('Selecciona un contenedor y pulsa "Conectar" para abrir la shell.\r\n');

    xtermRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  const sendResize = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== 1 || !xtermRef.current) return;
    fitRef.current?.fit();
    wsRef.current.send(JSON.stringify({
      type: 'resize',
      cols: xtermRef.current.cols,
      rows: xtermRef.current.rows,
    }));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectedTerm(false);
    setStatus('idle');
    xtermRef.current?.writeln('\r\n\x1b[33m── Sesión terminada ──\x1b[0m\r\n');
  }, []);

  const connect = useCallback(() => {
    if (!selected) {
      addToast('Selecciona un contenedor', 'error');
      return;
    }

    disconnect();
    setStatus('connecting');
    const term = xtermRef.current;
    if (!term) return;

    term.clear();
    term.writeln(`\x1b[36mConectando...\x1b[0m`);

    const ws = new WebSocket(getTerminalWsUrl(selected, shell));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setTimeout(sendResize, 100);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('{')) {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connected') {
            setConnectedTerm(true);
            term.writeln(`\x1b[32m✓ Conectado a ${msg.container} (${msg.shell})\x1b[0m\r\n`);
          } else if (msg.type === 'error') {
            term.writeln(`\x1b[31mError: ${msg.message}\x1b[0m`);
            addToast(msg.message, 'error');
            disconnect();
          }
          return;
        } catch { /* binary/text output */ }
      }
      term.write(event.data);
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31mError de conexión WebSocket\x1b[0m');
      addToast('Error de conexión', 'error');
      setStatus('error');
    };

    ws.onclose = () => {
      setConnectedTerm(false);
      setStatus('disconnected');
    };

    term.onData((data) => {
      if (ws.readyState === 1) ws.send(data);
    });
  }, [selected, shell, disconnect, addToast, sendResize]);

  useEffect(() => () => disconnect(), [disconnect]);

  const selectedContainer = containers.find((c) => c.id === selected);

  return (
    <div>
      <div className="terminal-layout">
        <aside className="logs-sidebar">
          <div className="logs-sidebar-header">
            <strong>Contenedores</strong>
            <button className="btn btn-ghost btn-sm" onClick={loadContainers}>↻</button>
          </div>
          <div className="logs-container-list">
            {containers.length === 0 ? (
              <p className="logs-empty">No hay contenedores en ejecución</p>
            ) : (
              containers.map((c) => (
                <button
                  key={c.id}
                  className={`logs-container-item ${selected === c.id ? 'active' : ''}`}
                  onClick={() => { if (connectedTerm) disconnect(); setSelected(c.id); }}
                >
                  <span className="badge-dot online-dot" />
                  <div>
                    <div className="logs-item-name">{c.name}</div>
                    <div className="logs-item-image">{c.image}</div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="terminal-options">
            <label>Shell</label>
            <select value={shell} onChange={(e) => setShell(e.target.value)} disabled={connectedTerm}>
              {SHELLS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </aside>

        <div className="terminal-main">
          <div className="logs-toolbar">
            <div className="logs-toolbar-left">
              <span className={`logs-status ${connectedTerm ? 'logs-status-streaming' : 'logs-status-idle'}`}>
                {connectedTerm ? '● Terminal activa' : status === 'connecting' ? '○ Conectando...' : '○ Desconectado'}
              </span>
              {selectedContainer && <span className="logs-target">{selectedContainer.name}</span>}
            </div>
            <div className="action-buttons">
              {!connectedTerm ? (
                <button className="btn btn-primary btn-sm" onClick={connect} disabled={!selected || !connected}>
                  ⚡ Conectar terminal
                </button>
              ) : (
                <button className="btn btn-danger btn-sm" onClick={disconnect}>✕ Desconectar</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => xtermRef.current?.clear()}>Limpiar</button>
              <button className="btn btn-ghost btn-sm" onClick={sendResize}>↻ Ajustar</button>
            </div>
          </div>

          <div className="terminal-container">
            <div ref={termRef} className="terminal-xterm" />
          </div>

          <p className="terminal-hint">
            Terminal interactiva vía Docker Exec. Funciona con Nextcloud, bases de datos y cualquier contenedor en ejecución.
            Si bash falla, prueba <code>/bin/sh</code> o <code>/bin/ash</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
