import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );

  return { addToast, ToastContainer };
}

export function Modal({ open, onClose, title, children, footer, large }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${large ? 'modal-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function useAutoRefresh(callback, interval, enabled = true) {
  useEffect(() => {
    if (!enabled || !interval) return;
    const id = setInterval(callback, interval);
    return () => clearInterval(id);
  }, [callback, interval, enabled]);
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            Confirmar
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

export function StateBadge({ state }) {
  const map = {
    running: 'badge-running',
    exited: 'badge-exited',
    paused: 'badge-paused',
    created: 'badge-created',
    restarting: 'badge-warning',
  };
  return (
    <span className={`badge ${map[state] || 'badge-created'}`}>
      <span className="badge-dot" />
      {state}
    </span>
  );
}

export function Loading() {
  return (
    <div className="loading-center">
      <div className="spinner" />
      <span>Cargando...</span>
    </div>
  );
}

/** Solo muestra pantalla de carga la primera vez; refrescos en segundo plano */
export function useSilentLoad() {
  const firstLoad = useRef(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async (asyncFn) => {
    if (firstLoad.current) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      return await asyncFn();
    } finally {
      firstLoad.current = false;
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  return { initialLoading, refreshing, run };
}

export function RefreshIndicator({ active }) {
  if (!active) return null;
  return (
    <span className="refresh-indicator" title="Actualizando...">
      <RefreshCw size={14} className="icon-spin" />
    </span>
  );
}

export function ConnectionBanner({ connected, error }) {
  if (connected) return null;
  return (
    <div className="connection-error">
      <AlertTriangle size={22} className="connection-error-icon" />
      <div>
        <h4>Docker no conectado</h4>
        <p>
          {error || 'No se pudo conectar al daemon de Docker. Verifica que Docker Desktop esté ejecutándose o configura la ruta del socket en Configuración.'}
        </p>
      </div>
    </div>
  );
}
