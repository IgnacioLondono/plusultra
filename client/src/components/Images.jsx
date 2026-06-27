import { useState, useEffect, useCallback } from 'react';
import { Search, Download, RefreshCw, Trash2, HardDrive } from 'lucide-react';
import { api } from '../api';
import { Loading, ConfirmDialog, useSilentLoad, RefreshIndicator } from './shared';

export default function Images({ connected, addToast, sub }) {
  const [images, setImages] = useState([]);
  const { initialLoading, refreshing, run } = useSilentLoad();
  const [search, setSearch] = useState('');
  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try { setImages(await api.getImages()); }
    catch (e) { addToast(e.message, 'error'); }
  }), [connected, addToast, run]);

  useEffect(() => { load(); }, [load]);

  const filtered = images.filter((img) =>
    !search || img.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const pull = async () => {
    if (!pullName.trim()) return;
    setPulling(true);
    try {
      await api.pullImage(pullName.trim());
      addToast(`Imagen ${pullName} descargada`, 'success');
      setPullName('');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setPulling(false);
  };

  const remove = async (id) => {
    try {
      await api.removeImage(id, true);
      addToast('Imagen eliminada', 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setConfirm(null);
  };

  if (sub === 'pull') {
    return (
      <div className="panel">
        <div className="panel-header"><Download size={18} /><h3>Descargar imagen</h3></div>
        <div className="panel-body">
          <div className="form-group">
            <label>Nombre de la imagen</label>
            <input value={pullName} onChange={(e) => setPullName(e.target.value)} placeholder="nginx:latest" />
            <p className="form-hint">Ej: nginx, postgres:16, nextcloud:latest</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={pull} disabled={pulling}>
            <Download size={16} />
            {pulling ? 'Descargando...' : 'Descargar imagen'}
          </button>
        </div>
      </div>
    );
  }

  if (initialLoading) return <Loading />;

  return (
    <div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} />
            <input placeholder="Buscar imagen..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="action-buttons">
            <RefreshIndicator active={refreshing} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Actualizar</button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><HardDrive size={40} strokeWidth={1.2} /><p>No hay imágenes</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Tags</th><th>ID</th><th>Tamaño</th><th>Virtual</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map((img) => (
                <tr key={img.id}>
                  <td>{img.tags.map((t) => <span key={t} className="badge badge-created" style={{ marginRight: 6 }}>{t}</span>)}</td>
                  <td className="mono">{img.shortId}</td>
                  <td>{img.sizeFormatted}</td>
                  <td>{img.virtualSizeFormatted}</td>
                  <td>
                    <button type="button" className="btn btn-danger btn-icon" onClick={() => setConfirm(img)} title="Eliminar"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger title="Eliminar imagen"
        message={`¿Eliminar ${confirm?.tags?.[0]}?`}
        onConfirm={() => remove(confirm.id)} />
    </div>
  );
}
