import { useState, useEffect, useCallback } from 'react';
import {
  Layers, Play, Square, RotateCw, Trash2, Eye, RefreshCw, ChevronRight,
} from 'lucide-react';
import { api } from '../api';
import { Loading, Modal, ConfirmDialog, StateBadge, useSilentLoad, RefreshIndicator } from './shared';

export default function Stacks({ connected, addToast, sub, onNavigate }) {
  const [stacks, setStacks] = useState([]);
  const [templates, setTemplates] = useState({});
  const { initialLoading, refreshing, run } = useSilentLoad();
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [deployForm, setDeployForm] = useState({ name: '', compose: '', pull: true, build: false });
  const [deploying, setDeploying] = useState(false);

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try {
      const [stacksData, templatesData] = await Promise.all([
        api.getStacks(),
        api.getStackTemplates(),
      ]);
      setStacks(stacksData);
      setTemplates(templatesData);
    } catch (e) { addToast(e.message, 'error'); }
  }), [connected, addToast, run]);

  useEffect(() => { load(); }, [load]);

  const viewDetail = async (name) => {
    try {
      setDetail(await api.getStack(name));
    } catch (e) { addToast(e.message, 'error'); }
  };

  const stackAction = async (name, action) => {
    try {
      const fn = { start: api.startStack, stop: api.stopStack }[action];
      await fn(name);
      addToast(`Stack ${action === 'start' ? 'iniciado' : 'detenido'}`, 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  const remove = async (name, volumes) => {
    try {
      await api.removeStack(name, volumes, false);
      addToast('Stack eliminado', 'success');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setConfirm(null);
  };

  const deploy = async () => {
    if (!deployForm.name || !deployForm.compose) {
      addToast('Nombre y compose son obligatorios', 'error');
      return;
    }
    setDeploying(true);
    try {
      await api.deployStack(deployForm);
      addToast('Stack desplegado correctamente', 'success');
      setDeployForm({ name: '', compose: '', pull: true, build: false });
      onNavigate?.('stacks', 'list');
      load();
    } catch (e) { addToast(e.message, 'error'); }
    setDeploying(false);
  };

  const applyTemplate = (key) => {
    const t = templates[key];
    if (!t) return;
    setDeployForm({ name: t.name, compose: t.compose, pull: true, build: false });
    onNavigate?.('stacks', 'deploy');
  };

  if (initialLoading && sub === 'list') return <Loading />;

  if (sub === 'deploy' || sub === 'editor') {
    return (
      <div className="stacks-deploy">
        {sub === 'deploy' && (
          <div className="template-grid">
            {Object.entries(templates).map(([key, t]) => (
              <button key={key} type="button" className="template-card" onClick={() => applyTemplate(key)}>
                <Layers size={24} />
                <div>
                  <strong>{t.label}</strong>
                  <p>{t.description}</p>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <h3>{sub === 'editor' ? 'Editor Compose' : 'Desplegar stack'}</h3>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre del stack</label>
                <input
                  value={deployForm.name}
                  onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })}
                  placeholder="mi-stack"
                />
              </div>
              <div className="form-group form-check-group">
                <label className="form-check">
                  <input type="checkbox" checked={deployForm.pull} onChange={(e) => setDeployForm({ ...deployForm, pull: e.target.checked })} />
                  Pull imágenes
                </label>
                <label className="form-check">
                  <input type="checkbox" checked={deployForm.build} onChange={(e) => setDeployForm({ ...deployForm, build: e.target.checked })} />
                  Build
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>docker-compose.yml</label>
              <textarea
                className="compose-editor"
                value={deployForm.compose}
                onChange={(e) => setDeployForm({ ...deployForm, compose: e.target.value })}
                placeholder="services:&#10;  web:&#10;    image: nginx:latest"
                spellCheck={false}
              />
            </div>
            <div className="action-buttons">
              <button type="button" className="btn btn-primary" onClick={deploy} disabled={deploying}>
                <Play size={16} />
                {deploying ? 'Desplegando...' : 'Desplegar stack'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="toolbar-count">{stacks.length} stacks</span>
          <div className="action-buttons">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate?.('stacks', 'deploy')}>
              <Play size={14} /> Desplegar
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
              <RefreshCw size={14} /> Actualizar
            </button>
            <RefreshIndicator active={refreshing} />
          </div>
        </div>

        {stacks.length === 0 ? (
          <div className="empty-state">
            <Layers size={40} strokeWidth={1.2} />
            <p>No hay stacks. Despliega uno con Compose.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate?.('stacks', 'deploy')}>
              Desplegar stack
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Contenedores</th>
                <th>Servicios</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stacks.map((s) => (
                <tr key={s.name}>
                  <td>
                    <div className="cell-primary">{s.name}</div>
                    {s.configFiles && <div className="cell-muted mono">{s.configFiles}</div>}
                  </td>
                  <td>
                    <span className={`badge badge-${s.status === 'active' ? 'running' : s.status === 'partial' ? 'paused' : 'exited'}`}>
                      <span className="badge-dot" />
                      {s.status}
                    </span>
                  </td>
                  <td>{s.runningCount}/{s.containerCount}</td>
                  <td>{s.services || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button type="button" className="btn btn-ghost btn-icon" title="Detalle" onClick={() => viewDetail(s.name)}>
                        <Eye size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon" title="Iniciar" onClick={() => stackAction(s.name, 'start')}>
                        <Play size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon" title="Detener" onClick={() => stackAction(s.name, 'stop')}>
                        <Square size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon" title="Reiniciar" onClick={() => stackAction(s.name, 'start')}>
                        <RotateCw size={15} />
                      </button>
                      <button type="button" className="btn btn-danger btn-icon" title="Eliminar" onClick={() => setConfirm(s)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Stack: ${detail?.name}`} large>
        {detail && (
          <>
            <div className="detail-grid">
              <div className="detail-item"><div className="label">Estado</div><div className="value">{detail.status}</div></div>
              <div className="detail-item"><div className="label">Contenedores</div><div className="value">{detail.containerCount}</div></div>
              <div className="detail-item"><div className="label">En ejecución</div><div className="value">{detail.runningCount}</div></div>
            </div>
            <h4 className="section-label">Servicios</h4>
            <table>
              <thead><tr><th>Servicio</th><th>Contenedor</th><th>Estado</th><th>Imagen</th></tr></thead>
              <tbody>
                {detail.containers?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.service}</td>
                    <td className="mono">{c.name}</td>
                    <td><StateBadge state={c.state} /></td>
                    <td className="mono">{c.image}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.compose && (
              <>
                <h4 className="section-label">Compose</h4>
                <pre className="compose-preview">{detail.compose}</pre>
              </>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger
        title="Eliminar stack"
        message={`¿Eliminar el stack "${confirm?.name}" y todos sus contenedores?`}
        onConfirm={() => remove(confirm.name, true)}
      />
    </div>
  );
}
