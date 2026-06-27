import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Plus, Network } from 'lucide-react';
import { api } from '../api';
import { Loading, ConfirmDialog, useSilentLoad, RefreshIndicator } from './shared';

export default function Networks({ connected, addToast, sub }) {
  const [networks, setNetworks] = useState([]);
  const { initialLoading, refreshing, run } = useSilentLoad();
  const [form, setForm] = useState({ name: '', driver: 'bridge', internal: false });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try { setNetworks(await api.getNetworks()); }
    catch (e) { addToast(e.message, 'error'); }
  }), [connected, addToast, run]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.createNetwork(form);
      addToast('Red creada', 'success');
      setForm({ name: '', driver: 'bridge', internal: false });
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  const remove = async (id) => {
    try {
      await api.removeNetwork(id);
      addToast('Red eliminada', 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setConfirm(null);
  };

  if (sub === 'create') {
    return (
      <div className="panel">
        <div className="panel-header"><Plus size={18} /><h3>Crear red</h3></div>
        <div className="panel-body">
          <div className="form-group">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mi-red" />
          </div>
          <div className="form-group">
            <label>Driver</label>
            <select value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })}>
              <option value="bridge">bridge</option>
              <option value="overlay">overlay</option>
              <option value="macvlan">macvlan</option>
            </select>
          </div>
          <label className="form-check" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={form.internal} onChange={(e) => setForm({ ...form, internal: e.target.checked })} />
            Red interna (sin acceso externo)
          </label>
          <button type="button" className="btn btn-primary" onClick={create}><Plus size={16} /> Crear red</button>
        </div>
      </div>
    );
  }

  if (initialLoading) return <Loading />;

  return (
    <div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="toolbar-count">{networks.length} redes</span>
          <div className="action-buttons">
            <RefreshIndicator active={refreshing} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Actualizar</button>
          </div>
        </div>
        {networks.length === 0 ? (
          <div className="empty-state"><Network size={40} strokeWidth={1.2} /><p>No hay redes</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Nombre</th><th>Driver</th><th>Scope</th><th>Contenedores</th><th>Interna</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.id}>
                  <td><strong>{n.name}</strong><br /><span className="mono cell-muted">{n.shortId}</span></td>
                  <td><span className="badge badge-created">{n.driver}</span></td>
                  <td>{n.scope}</td>
                  <td>{n.containers}</td>
                  <td>{n.internal ? 'Sí' : 'No'}</td>
                  <td>
                    {!['bridge', 'host', 'none'].includes(n.name) && (
                      <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirm(n)} title="Eliminar"><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger title="Eliminar red"
        message={`¿Eliminar la red "${confirm?.name}"?`}
        onConfirm={() => remove(confirm.id)} />
    </div>
  );
}
