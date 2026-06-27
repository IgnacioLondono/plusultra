import { useState } from 'react';
import { Plug, Save, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../api';

export default function Settings({ config, onSave, addToast, sub }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveConfig(form);
      onSave(saved);
      document.documentElement.style.setProperty('--accent', saved.accentColor);
      addToast('Configuración guardada', 'success');
    } catch (e) { addToast(e.message, 'error'); }
    setSaving(false);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.saveConfig(form);
      const result = await api.ping();
      setTestResult(result);
      if (result.ok) addToast('Conexión exitosa con Docker', 'success');
      else addToast(result.error, 'error');
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
      addToast(e.message, 'error');
    }
    setTesting(false);
  };

  const reset = async () => {
    try {
      const cfg = await api.resetConfig();
      setForm(cfg);
      onSave(cfg);
      addToast('Configuración restablecida', 'info');
    } catch (e) { addToast(e.message, 'error'); }
  };

  if (sub === 'docker') {
    return (
      <div>
        <div className="panel">
          <div className="panel-header"><Plug size={18} /><h3>Conexión Docker</h3></div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Protocolo</label>
                <select value={form.dockerProtocol} onChange={(e) => update('dockerProtocol', e.target.value)}>
                  <option value="socket">Socket Unix / Named Pipe</option>
                  <option value="http">HTTP (remoto)</option>
                  <option value="https">HTTPS (remoto)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Host / Socket</label>
                <input value={form.dockerHost} onChange={(e) => update('dockerHost', e.target.value)} />
                <p className="form-hint">Windows: //./pipe/docker_engine · Linux: /var/run/docker.sock</p>
              </div>
            </div>
            <div className="action-buttons">
              <button type="button" className="btn btn-secondary" onClick={testConnection} disabled={testing}>
                <Plug size={16} /> {testing ? 'Probando...' : 'Probar conexión'}
              </button>
            </div>
            {testResult && (
              <div className={`test-result ${testResult.ok ? 'ok' : 'err'}`}>
                {testResult.ok ? (
                  <><CheckCircle size={16} /> Conectado — Docker {testResult.info?.ServerVersion}</>
                ) : (
                  <><XCircle size={16} /> {testResult.error}</>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="action-buttons" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header"><h3>Interfaz</h3></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Intervalo de actualización (ms)</label>
              <input type="number" value={form.refreshInterval} onChange={(e) => update('refreshInterval', parseInt(e.target.value))} min={1000} step={1000} />
            </div>
            <div className="form-group">
              <label>Color de acento</label>
              <div className="color-input-row">
                <input type="color" value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
                <input value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Líneas de logs</label>
              <input type="number" value={form.logTailLines} onChange={(e) => update('logTailLines', parseInt(e.target.value))} min={50} max={5000} />
            </div>
            <div className="form-group">
              <label>Elementos por página</label>
              <input type="number" value={form.pageSize} onChange={(e) => update('pageSize', parseInt(e.target.value))} min={10} max={100} />
            </div>
            <div className="form-group">
              <label>Política de reinicio por defecto</label>
              <select value={form.defaultRestartPolicy} onChange={(e) => update('defaultRestartPolicy', e.target.value)}>
                <option value="no">no</option>
                <option value="always">always</option>
                <option value="unless-stopped">unless-stopped</option>
                <option value="on-failure">on-failure</option>
              </select>
            </div>
            <div className="form-group">
              <label>Filtro global de contenedores</label>
              <input value={form.containerNameFilter} onChange={(e) => update('containerNameFilter', e.target.value)} placeholder="nextcloud, nginx..." />
            </div>
          </div>
          <div className="checkbox-list">
            <label className="form-check"><input type="checkbox" checked={form.autoRefresh} onChange={(e) => update('autoRefresh', e.target.checked)} /> Actualización automática</label>
            <label className="form-check"><input type="checkbox" checked={form.showStoppedContainers} onChange={(e) => update('showStoppedContainers', e.target.checked)} /> Mostrar contenedores detenidos</label>
            <label className="form-check"><input type="checkbox" checked={form.confirmBeforeRemove} onChange={(e) => update('confirmBeforeRemove', e.target.checked)} /> Confirmar antes de eliminar</label>
          </div>
        </div>
      </div>

      <div className="action-buttons" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar configuración'}</button>
        <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw size={16} /> Restablecer</button>
      </div>
    </div>
  );
}
