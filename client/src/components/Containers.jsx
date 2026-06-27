import { useState, useEffect, useCallback } from 'react';
import {
  Search, Play, Square, RotateCw, Pause, ScrollText, Terminal,
  FileText, Info, Pencil, Trash2, RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import { Loading, Modal, StateBadge, ConfirmDialog, useSilentLoad, RefreshIndicator } from './shared';

export default function Containers({ connected, config, addToast, onOpenLogs, onOpenTerminal }) {
  const [containers, setContainers] = useState([]);
  const { initialLoading, refreshing, run } = useSilentLoad();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try {
      setContainers(await api.getContainers());
    } catch (e) { addToast(e.message, 'error'); }
  }), [connected, addToast, run]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!config.autoRefresh || !connected) return;
    const id = setInterval(load, config.refreshInterval);
    return () => clearInterval(id);
  }, [load, config, connected]);

  const filtered = containers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.image.toLowerCase().includes(search.toLowerCase())
  );

  const doAction = async (id, action, label) => {
    setActionLoading(id + action);
    try {
      const fn = { start: api.startContainer, stop: api.stopContainer, restart: api.restartContainer, pause: api.pauseContainer, unpause: api.unpauseContainer }[action];
      await fn(id);
      addToast(`${label} correctamente`, 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setActionLoading(null);
  };

  const viewDetail = async (id) => {
    try {
      const data = await api.getContainer(id);
      setDetail({ id, ...data });
    } catch (e) { addToast(e.message, 'error'); }
  };

  const viewLogs = async (id, name) => {
    try {
      const data = await api.getLogs(id, config.logTailLines);
      setLogs({ id, name, text: data.logs });
    } catch (e) { addToast(e.message, 'error'); }
  };

  const removeContainer = async (id) => {
    try {
      await api.removeContainer(id, true, false);
      addToast('Contenedor eliminado', 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setConfirm(null);
  };

  const bulkAction = async (action) => {
    if (!selected.length) return;
    try {
      const res = await api.bulkAction(selected, action);
      const ok = res.results.filter((r) => r.success).length;
      addToast(`${ok}/${selected.length} contenedores procesados`, 'success');
      setSelected([]);
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(selected.length === filtered.length ? [] : filtered.map((c) => c.id));
  };

  const saveEdit = async () => {
    try {
      if (editModal.type === 'rename') {
        await api.renameContainer(editModal.id, editModal.name);
        addToast('Nombre actualizado', 'success');
      } else {
        await api.recreateContainer(editModal.id, {
          image: editModal.image,
          env: editModal.env.split('\n').filter(Boolean),
          restartPolicy: editModal.restartPolicy,
        });
        addToast('Contenedor recreado', 'success');
      }
      setEditModal(null);
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  if (initialLoading) return <Loading />;

  return (
    <div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} />
            <input placeholder="Buscar contenedor o imagen..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="action-buttons">
            {selected.length > 0 && (
              <>
                <button type="button" className="btn btn-success btn-sm" onClick={() => bulkAction('start')}><Play size={14} /> Iniciar ({selected.length})</button>
                <button type="button" className="btn btn-warning btn-sm" onClick={() => bulkAction('stop')}><Square size={14} /> Detener</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => bulkAction('restart')}><RotateCw size={14} /> Reiniciar</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'bulk' })}><Trash2 size={14} /> Eliminar</button>
              </>
            )}
            <RefreshIndicator active={refreshing} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Actualizar</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">No hay contenedores</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="checkbox-col"><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th>Nombre</th><th>Imagen</th><th>Estado</th><th>Puertos</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="checkbox-col"><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                  <td><strong>{c.name}</strong><br /><span className="mono" style={{ color: 'var(--text-muted)' }}>{c.shortId}</span></td>
                  <td className="mono">{c.image}</td>
                  <td><StateBadge state={c.state} /><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.status}</span></td>
                  <td className="mono">{c.ports}</td>
                  <td>
                    <div className="action-buttons">
                      {c.state !== 'running' && (
                        <button type="button" className="btn btn-ghost btn-icon" disabled={!!actionLoading} onClick={() => doAction(c.id, 'start', 'Iniciado')} title="Iniciar"><Play size={15} /></button>
                      )}
                      {c.state === 'running' && (
                        <>
                          <button type="button" className="btn btn-ghost btn-icon" disabled={!!actionLoading} onClick={() => doAction(c.id, 'stop', 'Detenido')} title="Detener"><Square size={15} /></button>
                          <button type="button" className="btn btn-ghost btn-icon" disabled={!!actionLoading} onClick={() => doAction(c.id, 'restart', 'Reiniciado')} title="Reiniciar"><RotateCw size={15} /></button>
                          <button type="button" className="btn btn-ghost btn-icon" disabled={!!actionLoading} onClick={() => doAction(c.id, 'pause', 'Pausado')} title="Pausar"><Pause size={15} /></button>
                        </>
                      )}
                      {c.state === 'paused' && (
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => doAction(c.id, 'unpause', 'Reanudado')} title="Reanudar"><Play size={15} /></button>
                      )}
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => onOpenLogs?.(c.id)} title="Logs en vivo"><ScrollText size={15} /></button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => onOpenTerminal?.(c.id)} title="Terminal"><Terminal size={15} /></button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => viewLogs(c.id, c.name)} title="Logs estáticos"><FileText size={15} /></button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => viewDetail(c.id)} title="Detalle"><Info size={15} /></button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEditModal({ type: 'edit', id: c.id, image: c.image, env: '', restartPolicy: config.defaultRestartPolicy })} title="Editar"><Pencil size={15} /></button>
                      <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirm({ type: 'single', id: c.id, name: c.name })} title="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalle del contenedor" large>
        {detail && (
          <>
            <div className="detail-grid">
              <div className="detail-item"><div className="label">ID</div><div className="value mono">{detail.inspect?.Id?.substring(0, 12)}</div></div>
              <div className="detail-item"><div className="label">Estado</div><div className="value">{detail.inspect?.State?.Status}</div></div>
              <div className="detail-item"><div className="label">CPU</div><div className="value">{detail.stats?.cpuPercent ?? '—'}%</div></div>
              <div className="detail-item"><div className="label">Memoria</div><div className="value">{detail.stats?.memUsageFormatted ?? '—'} / {detail.stats?.memLimitFormatted ?? '—'}</div></div>
              <div className="detail-item"><div className="label">Imagen</div><div className="value">{detail.inspect?.Config?.Image}</div></div>
              <div className="detail-item"><div className="label">IP</div><div className="value mono">{detail.inspect?.NetworkSettings?.IPAddress || '—'}</div></div>
            </div>
            <h4 style={{ marginBottom: 12 }}>Variables de entorno</h4>
            <div className="logs-viewer" style={{ maxHeight: 150 }}>
              {(detail.inspect?.Config?.Env || []).join('\n') || 'Sin variables'}
            </div>
            <h4 style={{ margin: '16px 0 12px' }}>Montajes</h4>
            <div className="logs-viewer" style={{ maxHeight: 120 }}>
              {(detail.inspect?.Mounts || []).map((m) => `${m.Source} → ${m.Destination}`).join('\n') || 'Sin montajes'}
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!logs} onClose={() => setLogs(null)} title={`Logs — ${logs?.name}`} large footer={
        <button type="button" className="btn btn-ghost" onClick={() => viewLogs(logs.id, logs.name)}><RefreshCw size={14} /> Actualizar logs</button>
      }>
        <div className="logs-viewer">{logs?.text || 'Sin logs'}</div>
      </Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar / Recrear contenedor" footer={
        <>
          <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={saveEdit}>Guardar y recrear</button>
        </>
      }>
        {editModal && (
          <div className="form-grid">
            <div className="form-group">
              <label>Imagen</label>
              <input value={editModal.image} onChange={(e) => setEditModal({ ...editModal, image: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Política de reinicio</label>
              <select value={editModal.restartPolicy} onChange={(e) => setEditModal({ ...editModal, restartPolicy: e.target.value })}>
                <option value="no">no</option>
                <option value="always">always</option>
                <option value="unless-stopped">unless-stopped</option>
                <option value="on-failure">on-failure</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Variables de entorno (una por línea)</label>
              <textarea value={editModal.env} onChange={(e) => setEditModal({ ...editModal, env: e.target.value })} placeholder="NODE_ENV=production&#10;PORT=3000" />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger
        title="Confirmar eliminación"
        message={confirm?.type === 'bulk' ? `¿Eliminar ${selected.length} contenedores?` : `¿Eliminar el contenedor "${confirm?.name}"?`}
        onConfirm={() => confirm?.type === 'bulk' ? bulkAction('remove') : removeContainer(confirm.id)}
      />
    </div>
  );
}
