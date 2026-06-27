import { useState, useEffect, useCallback } from 'react';
import { Settings2, Save, RotateCw } from 'lucide-react';
import { api } from '../api';
import { Loading } from './shared';

function portsFromInspect(inspect) {
  const bindings = inspect?.HostConfig?.PortBindings || {};
  return Object.entries(bindings)
    .map(([cp, hosts]) => {
      const port = cp.split('/')[0];
      const host = hosts?.[0]?.HostPort;
      return host ? `${port}:${host}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

function volumesFromInspect(inspect) {
  return (inspect?.HostConfig?.Binds || []).join('\n');
}

function labelsFromInspect(inspect) {
  const labels = inspect?.Config?.Labels || {};
  return Object.entries(labels)
    .filter(([k]) => !k.startsWith('com.docker.'))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function parsePorts(text) {
  const ports = {};
  for (const line of text.split('\n').filter(Boolean)) {
    const [container, host] = line.split(':').map((s) => s.trim());
    if (container && host) ports[container] = host;
  }
  return ports;
}

function parseLabels(text) {
  const labels = {};
  for (const line of text.split('\n').filter(Boolean)) {
    const i = line.indexOf('=');
    if (i > 0) labels[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return labels;
}

export default function ContainerConfigure({ connected, config, addToast }) {
  const [containers, setContainers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    if (!connected) return;
    try {
      const list = await api.getContainers();
      setContainers(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e) { addToast(e.message, 'error'); }
  }, [connected, addToast]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadContainer = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getContainer(id);
      const inspect = data.inspect;
      setForm({
        id,
        name: inspect.Name?.replace(/^\//, '') || '',
        image: inspect.Config?.Image || '',
        env: (inspect.Config?.Env || []).join('\n'),
        ports: portsFromInspect(inspect),
        volumes: volumesFromInspect(inspect),
        cmd: (inspect.Config?.Cmd || []).join(' '),
        labels: labelsFromInspect(inspect),
        restartPolicy: inspect.HostConfig?.RestartPolicy?.Name || config.defaultRestartPolicy,
        networkMode: inspect.HostConfig?.NetworkMode || 'bridge',
        memoryLimit: inspect.HostConfig?.Memory || 0,
        cpuShares: inspect.HostConfig?.CpuShares || 0,
      });
    } catch (e) { addToast(e.message, 'error'); }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedId) loadContainer(selectedId);
  }, [selectedId]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.recreateContainer(form.id, {
        name: form.name,
        image: form.image,
        env: form.env.split('\n').filter(Boolean),
        ports: parsePorts(form.ports),
        volumes: form.volumes.split('\n').filter(Boolean),
        cmd: form.cmd,
        labels: parseLabels(form.labels),
        restartPolicy: form.restartPolicy,
        networkMode: form.networkMode,
        memoryLimit: parseInt(form.memoryLimit) || 0,
        cpuShares: parseInt(form.cpuShares) || 0,
      });
      addToast('Contenedor recreado con la nueva configuración', 'success');
      loadList();
      loadContainer(form.id);
    } catch (e) { addToast(e.message, 'error'); }
    setSaving(false);
  };

  if (!connected) {
    return <div className="empty-state">Conecta Docker para configurar contenedores</div>;
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header"><Settings2 size={18} /><h3>Configurar contenedor</h3></div>
        <div className="panel-body">
          <div className="form-group" style={{ maxWidth: 480, marginBottom: 20 }}>
            <label>Seleccionar contenedor</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.image}</option>
              ))}
            </select>
          </div>

          {loading || !form ? (
            <Loading />
          ) : (
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Imagen</label>
                <input value={form.image} onChange={(e) => update('image', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Política de reinicio</label>
                <select value={form.restartPolicy} onChange={(e) => update('restartPolicy', e.target.value)}>
                  <option value="no">no</option>
                  <option value="always">always</option>
                  <option value="unless-stopped">unless-stopped</option>
                  <option value="on-failure">on-failure</option>
                </select>
              </div>
              <div className="form-group">
                <label>Modo de red</label>
                <select value={form.networkMode} onChange={(e) => update('networkMode', e.target.value)}>
                  <option value="bridge">bridge</option>
                  <option value="host">host</option>
                  <option value="none">none</option>
                </select>
              </div>
              <div className="form-group">
                <label>Límite memoria (bytes, 0 = sin límite)</label>
                <input type="number" value={form.memoryLimit} onChange={(e) => update('memoryLimit', e.target.value)} min={0} />
              </div>
              <div className="form-group">
                <label>CPU shares</label>
                <input type="number" value={form.cpuShares} onChange={(e) => update('cpuShares', e.target.value)} min={0} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Comando</label>
                <input value={form.cmd} onChange={(e) => update('cmd', e.target.value)} placeholder="nginx -g daemon off;" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Variables de entorno (una por línea)</label>
                <textarea value={form.env} onChange={(e) => update('env', e.target.value)} rows={4} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Puertos (contenedor:host por línea)</label>
                <textarea value={form.ports} onChange={(e) => update('ports', e.target.value)} rows={3} placeholder="80:8080" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Volúmenes (bind mounts)</label>
                <textarea value={form.volumes} onChange={(e) => update('volumes', e.target.value)} rows={3} placeholder="/host/path:/container/path" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Labels (clave=valor por línea)</label>
                <textarea value={form.labels} onChange={(e) => update('labels', e.target.value)} rows={3} />
              </div>
            </div>
          )}
        </div>
      </div>

      {form && !loading && (
        <div className="action-buttons" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar y recrear'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => loadContainer(selectedId)}>
            <RotateCw size={16} /> Recargar
          </button>
        </div>
      )}

      <p className="form-hint" style={{ marginTop: 12 }}>
        Los cambios requieren recrear el contenedor. Se detendrá y volverá a crearse con la nueva configuración.
      </p>
    </div>
  );
}
