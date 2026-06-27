import { useState } from 'react';
import { Rocket, Play } from 'lucide-react';
import { api } from '../api';

const PRESETS = [
  { name: 'Nginx', image: 'nginx:latest', ports: { '80': '8080' } },
  { name: 'PostgreSQL', image: 'postgres:16', ports: { '5432': '5432' }, env: ['POSTGRES_PASSWORD=secret', 'POSTGRES_USER=admin', 'POSTGRES_DB=mydb'] },
  { name: 'Redis', image: 'redis:alpine', ports: { '6379': '6379' } },
  { name: 'Nextcloud', image: 'nextcloud:latest', ports: { '80': '8888' } },
  { name: 'MariaDB', image: 'mariadb:latest', ports: { '3306': '3306' }, env: ['MYSQL_ROOT_PASSWORD=secret'] },
  { name: 'Ubuntu', image: 'ubuntu:latest', cmd: 'sleep infinity' },
];

export default function Launch({ config, addToast, onLaunched }) {
  const [form, setForm] = useState({
    image: '',
    name: '',
    env: '',
    ports: '',
    volumes: '',
    cmd: '',
    restartPolicy: config.defaultRestartPolicy,
    networkMode: 'bridge',
    autoStart: true,
  });
  const [launching, setLaunching] = useState(false);

  const applyPreset = (preset) => {
    setForm({
      ...form,
      image: preset.image,
      name: preset.name.toLowerCase().replace(/\s/g, '-'),
      env: (preset.env || []).join('\n'),
      ports: preset.ports ? Object.entries(preset.ports).map(([k, v]) => `${k}:${v}`).join('\n') : '',
      cmd: preset.cmd || '',
    });
  };

  const parsePorts = (text) => {
    const ports = {};
    text.split('\n').filter(Boolean).forEach((line) => {
      const [container, host] = line.split(':');
      if (container && host) ports[container.trim()] = host.trim();
    });
    return ports;
  };

  const parseVolumes = (text) =>
    text.split('\n').filter(Boolean).map((line) => {
      const parts = line.split(':');
      return parts.length >= 2 ? `${parts[0]}:${parts[1]}${parts[2] === 'ro' ? ':ro' : ''}` : line;
    });

  const launch = async () => {
    if (!form.image.trim()) {
      addToast('La imagen es obligatoria', 'error');
      return;
    }
    setLaunching(true);
    try {
      await api.createContainer({
        image: form.image.trim(),
        name: form.name.trim() || undefined,
        env: form.env.split('\n').filter(Boolean),
        ports: parsePorts(form.ports),
        volumes: parseVolumes(form.volumes),
        cmd: form.cmd || undefined,
        restartPolicy: form.restartPolicy,
        networkMode: form.networkMode,
        autoStart: form.autoStart,
      });
      addToast('Contenedor lanzado correctamente', 'success');
      onLaunched?.();
    } catch (e) {
      addToast(e.message, 'error');
    }
    setLaunching(false);
  };

  return (
    <div>
      <div className="settings-section">
        <h3>Plantillas rápidas</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button key={p.name} className="btn btn-secondary btn-sm" onClick={() => applyPreset(p)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>Lanzar nuevo contenedor</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Imagen *</label>
            <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="nginx:latest" />
          </div>
          <div className="form-group">
            <label>Nombre del contenedor</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mi-contenedor" />
          </div>
          <div className="form-group">
            <label>Política de reinicio</label>
            <select value={form.restartPolicy} onChange={(e) => setForm({ ...form, restartPolicy: e.target.value })}>
              <option value="no">no</option>
              <option value="always">always</option>
              <option value="unless-stopped">unless-stopped</option>
              <option value="on-failure">on-failure</option>
            </select>
          </div>
          <div className="form-group">
            <label>Modo de red</label>
            <select value={form.networkMode} onChange={(e) => setForm({ ...form, networkMode: e.target.value })}>
              <option value="bridge">bridge</option>
              <option value="host">host</option>
              <option value="none">none</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Variables de entorno (una por línea)</label>
            <textarea value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })} placeholder="NODE_ENV=production&#10;PORT=3000" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Puertos (formato contenedor:host, uno por línea)</label>
            <textarea value={form.ports} onChange={(e) => setForm({ ...form, ports: e.target.value })} placeholder="80:8080&#10;443:8443" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Volúmenes (formato origen:destino[:ro])</label>
            <textarea value={form.volumes} onChange={(e) => setForm({ ...form, volumes: e.target.value })} placeholder="/ruta/local:/ruta/contenedor&#10;mi-volumen:/data" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Comando (opcional)</label>
            <input value={form.cmd} onChange={(e) => setForm({ ...form, cmd: e.target.value })} placeholder="sleep infinity" />
          </div>
        </div>

        <label className="form-check" style={{ marginBottom: 20 }}>
          <input type="checkbox" checked={form.autoStart} onChange={(e) => setForm({ ...form, autoStart: e.target.checked })} />
          Iniciar automáticamente al crear
        </label>

        <button type="button" className="btn btn-primary" onClick={launch} disabled={launching}>
          <Rocket size={16} />
          {launching ? 'Lanzando...' : 'Lanzar contenedor'}
        </button>
      </div>
    </div>
  );
}
