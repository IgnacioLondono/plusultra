import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Play, Square, Download, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { getLogsWsUrl } from '../ws';

export default function Logs({ connected, config, addToast, initialContainer, onClearTarget }) {
  const [containers, setContainers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [logText, setLogText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('idle');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const wsRef = useRef(null);
  const logEndRef = useRef(null);
  const logBoxRef = useRef(null);

  const loadContainers = useCallback(async () => {
    if (!connected) return;
    try {
      const data = await api.getContainers();
      const running = data.filter((c) => c.state === 'running');
      setContainers(running);
      if (!selected && running.length > 0) {
        setSelected(running[0].id);
      }
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

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStreaming(false);
    setStatus('idle');
  }, []);

  const connect = useCallback(() => {
    if (!selected) {
      addToast('Selecciona un contenedor', 'error');
      return;
    }
    disconnect();
    setLogText('');
    setStatus('connecting');

    const ws = new WebSocket(getLogsWsUrl(selected, config.logTailLines));
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          setStreaming(true);
          setStatus('streaming');
          setLogText((prev) => prev + `\n── Conectado a ${msg.container} ──\n`);
        } else if (msg.type === 'log') {
          setLogText((prev) => prev + msg.data);
        } else if (msg.type === 'error') {
          addToast(msg.message, 'error');
          setStatus('error');
        } else if (msg.type === 'end') {
          setStreaming(false);
          setStatus('ended');
          setLogText((prev) => prev + `\n── ${msg.message} ──\n`);
        }
      } catch {
        setLogText((prev) => prev + event.data);
      }
    };
    ws.onerror = () => {
      addToast('Error de conexión WebSocket', 'error');
      setStatus('error');
    };
    ws.onclose = () => {
      setStreaming(false);
      if (status !== 'error') setStatus('disconnected');
    };
  }, [selected, config.logTailLines, disconnect, addToast, status]);

  useEffect(() => () => disconnect(), [disconnect]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logText, autoScroll]);

  const selectedContainer = containers.find((c) => c.id === selected);

  const filteredLog = search
    ? logText.split('\n').filter((line) => line.toLowerCase().includes(search.toLowerCase())).join('\n')
    : logText;

  const downloadLogs = () => {
    const blob = new Blob([logText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedContainer?.name || 'logs'}-${Date.now()}.log`;
    a.click();
  };

  const clearLogs = () => setLogText('');

  return (
    <div>
      <div className="logs-layout">
        <aside className="logs-sidebar">
          <div className="logs-sidebar-header">
            <strong>Contenedores</strong>
            <button type="button" className="btn btn-ghost btn-icon" onClick={loadContainers} title="Actualizar"><RefreshCw size={14} /></button>
          </div>
          <div className="logs-container-list">
            {containers.length === 0 ? (
              <p className="logs-empty">No hay contenedores en ejecución</p>
            ) : (
              containers.map((c) => (
                <button
                  key={c.id}
                  className={`logs-container-item ${selected === c.id ? 'active' : ''}`}
                  onClick={() => { setSelected(c.id); disconnect(); }}
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
        </aside>

        <div className="logs-main">
          <div className="logs-toolbar">
            <div className="logs-toolbar-left">
              <span className={`logs-status logs-status-${status}`}>
                {status === 'streaming' && '● En vivo'}
                {status === 'connecting' && '○ Conectando...'}
                {status === 'idle' && '○ Desconectado'}
                {status === 'disconnected' && '○ Desconectado'}
                {status === 'ended' && '○ Finalizado'}
                {status === 'error' && '✕ Error'}
              </span>
              {selectedContainer && (
                <span className="logs-target">{selectedContainer.name}</span>
              )}
            </div>
            <div className="table-search" style={{ maxWidth: 220 }}>
              <Search size={14} />
              <input placeholder="Filtrar logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="action-buttons">
              <label className="form-check" style={{ margin: 0 }}>
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                Auto-scroll
              </label>
              {!streaming ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={connect} disabled={!selected}>
                  <Play size={14} /> Ver logs en vivo
                </button>
              ) : (
                <button type="button" className="btn btn-warning btn-sm" onClick={disconnect}><Square size={14} /> Detener</button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearLogs}>Limpiar</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadLogs} disabled={!logText}><Download size={14} /> Descargar</button>
            </div>
          </div>

          <div className="logs-viewer logs-viewer-live" ref={logBoxRef}>
            {logText ? (
              <>
                <pre>{filteredLog}</pre>
                <div ref={logEndRef} />
              </>
            ) : (
              <div className="logs-placeholder">
                {connected
                  ? 'Selecciona un contenedor y pulsa "Ver logs en vivo"'
                  : 'Conecta Docker para ver los logs'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
