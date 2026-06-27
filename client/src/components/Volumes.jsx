import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Plus, Database } from 'lucide-react';
import { api } from '../api';
import { Loading, ConfirmDialog, useSilentLoad, RefreshIndicator } from './shared';

export default function Volumes({ connected, addToast, sub }) {
  const [volumes, setVolumes] = useState([]);
  const { initialLoading, refreshing, run } = useSilentLoad();
  const [form, setForm] = useState({ name: '', driver: 'local' });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try { setVolumes(await api.getVolumes()); }
    catch (e) { addToast(e.message, 'error'); }
  }), [connected, addToast, run]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.createVolume(form);
      addToast('Volumen creado', 'success');
      setForm({ name: '', driver: 'local' });
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  const remove = async (name) => {
    try {
      await api.removeVolume(name, true);
      addToast('Volumen eliminado', 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setConfirm(null);
  };

  if (sub === 'create') {
    return (
      <div className="panel">
        <div className="panel-header"><Plus size={18} /><h3>Crear volumen</h3></div>
        <div className="panel-body">
          <div className="form-group">
            <label>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mi-volumen" />
          </div>
          <div className="form-group">
            <label>Driver</label>
            <select value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })}>
              <option value="local">local</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={create}><Plus size={16} /> Crear volumen</button>
        </div>
      </div>
    );
  }

  if (initialLoading) return <Loading />;
  return (
    <div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <strong>{volumes.length} volúmenes</strong>
          <div className="action-buttons">
            <RefreshIndicator active={refreshing} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Actualizar</button>
          </div>        </div>
        {volumes.length === 0 ? (
          <div className="empty-state"><Database size={40} strokeWidth={1.2} /><p>No hay volúmenes</p></div>        ) : (
          <table>
            <thead>
              <tr><th>Nombre</th><th>Driver</th><th>Punto de montaje</th><th>Creado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.name}>
                  <td><strong>{v.name}</strong></td>
                  <td><span className="badge badge-created">{v.driver}</span></td>
                  <td className="mono" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.mountpoint}</td>
                  <td>{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirm(v)} title="Eliminar"><Trash2 size={15} /></button>                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger title="Eliminar volumen"
        message={`¿Eliminar el volumen "${confirm?.name}"? Los datos se perderán.`}
        onConfirm={() => remove(confirm.name)} />
    </div>
  );
}
