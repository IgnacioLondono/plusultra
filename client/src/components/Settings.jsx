import { useState, useEffect, useRef } from 'react';
import { Plug, Save, RotateCcw, CheckCircle, XCircle, Palette, Upload, Trash2, ImageIcon } from 'lucide-react';
import { api } from '../api';
import { applyAppearance } from '../utils/theme';

const GRADIENT_PRESETS = [
  { label: 'Púrpura oscuro', value: 'linear-gradient(135deg, #0f1117 0%, #1a1035 50%, #0f1117 100%)' },
  { label: 'Océano', value: 'linear-gradient(135deg, #0a1628 0%, #0d3b4d 50%, #0a1628 100%)' },
  { label: 'Atardecer', value: 'linear-gradient(135deg, #1a0f17 0%, #3d1a2e 50%, #1a0f17 100%)' },
  { label: 'Bosque', value: 'linear-gradient(135deg, #0d1410 0%, #1a2e1f 50%, #0d1410 100%)' },
];

export default function Settings({ config, onSave, onPreview, addToast, sub }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm({ ...config });
  }, [config, sub]);

  const preview = (next) => {
    applyAppearance(next);
    onPreview?.(next);
  };

  const update = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (sub === 'appearance') preview(next);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveConfig(form);
      onSave(saved);
      preview(saved);
      addToast('Configuración guardada', 'success');
    } catch (e) { addToast(e.message, 'error'); }
    setSaving(false);
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Selecciona un archivo de imagen', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('La imagen no puede superar 5 MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const saved = await api.uploadBackground(dataUrl);
      setForm(saved);
      onSave(saved);
      preview(saved);
      addToast('Fondo subido correctamente', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeBg = async () => {
    try {
      const saved = await api.removeBackground();
      setForm(saved);
      onSave(saved);
      preview(saved);
      addToast('Fondo eliminado', 'info');
    } catch (e) { addToast(e.message, 'error'); }
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
      preview(cfg);
      addToast('Configuración restablecida', 'info');
    } catch (e) { addToast(e.message, 'error'); }
  };

  const bgPreviewUrl = form.backgroundType === 'image' && form.backgroundImage
    ? `${form.backgroundImage}${form.backgroundImage.includes('?') ? '&' : '?'}v=${form.backgroundVersion || 0}`
    : null;

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

  if (sub === 'appearance') {
    return (
      <div>
        <div className="panel">
          <div className="panel-header"><Palette size={18} /><h3>Personalización de la interfaz</h3></div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Título de la aplicación</label>
                <input value={form.appTitle || ''} onChange={(e) => update('appTitle', e.target.value)} placeholder="Plusultra" />
              </div>
              <div className="form-group">
                <label>Subtítulo</label>
                <input value={form.appSubtitle || ''} onChange={(e) => update('appSubtitle', e.target.value)} placeholder="Panel Docker universal" />
              </div>
              <div className="form-group">
                <label>Tema</label>
                <select value={form.theme} onChange={(e) => update('theme', e.target.value)}>
                  <option value="dark">Oscuro</option>
                  <option value="light">Claro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Color de acento</label>
                <div className="color-input-row">
                  <input type="color" value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
                  <input value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Tipo de fondo</label>
                <select value={form.backgroundType || 'gradient'} onChange={(e) => update('backgroundType', e.target.value)}>
                  <option value="gradient">Degradado</option>
                  <option value="solid">Color sólido</option>
                  <option value="image">Imagen</option>
                </select>
              </div>

              {form.backgroundType === 'image' && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Imagen de fondo</label>
                  <div className="bg-upload-zone">
                    {bgPreviewUrl ? (
                      <div className="bg-preview" style={{ backgroundImage: `url(${bgPreviewUrl})` }} />
                    ) : (
                      <div className="bg-preview bg-preview-empty"><ImageIcon size={32} /></div>
                    )}
                    <div className="bg-upload-actions">
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleBgUpload} hidden />
                      <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir imagen'}
                      </button>
                      {bgPreviewUrl && (
                        <button type="button" className="btn btn-ghost" onClick={removeBg}>
                          <Trash2 size={16} /> Quitar fondo
                        </button>
                      )}
                    </div>
                    <p className="form-hint">PNG, JPG, WebP o GIF — máximo 5 MB. Se guarda en el servidor.</p>
                  </div>
                </div>
              )}

              {form.backgroundType === 'solid' && (
                <div className="form-group">
                  <label>Color de fondo</label>
                  <div className="color-input-row">
                    <input type="color" value={form.backgroundColor || '#0f1117'} onChange={(e) => update('backgroundColor', e.target.value)} />
                    <input value={form.backgroundColor || '#0f1117'} onChange={(e) => update('backgroundColor', e.target.value)} />
                  </div>
                </div>
              )}

              {form.backgroundType === 'gradient' && (
                <>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Degradado CSS</label>
                    <input value={form.backgroundGradient || ''} onChange={(e) => update('backgroundGradient', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Presets de degradado</label>
                    <div className="gradient-presets">
                      {GRADIENT_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className="gradient-preset-btn"
                          style={{ background: p.value }}
                          onClick={() => update('backgroundGradient', p.value)}
                          title={p.label}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {form.backgroundType === 'image' && (
                <div className="form-group">
                  <label>Oscurecer fondo ({Math.round((form.backgroundOverlay ?? 0.35) * 100)}%)</label>
                  <input type="range" min={0} max={0.8} step={0.05} value={form.backgroundOverlay ?? 0.35} onChange={(e) => update('backgroundOverlay', parseFloat(e.target.value))} />
                </div>
              )}

              <div className="form-group">
                <label>Transparencia sidebar ({Math.round((form.sidebarOpacity ?? 1) * 100)}%)</label>
                <input type="range" min={0.4} max={1} step={0.05} value={form.sidebarOpacity ?? 1} onChange={(e) => update('sidebarOpacity', parseFloat(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Transparencia paneles ({Math.round((form.panelOpacity ?? 0.92) * 100)}%)</label>
                <input type="range" min={0.4} max={1} step={0.05} value={form.panelOpacity ?? 0.92} onChange={(e) => update('panelOpacity', parseFloat(e.target.value))} />
              </div>
            </div>
          </div>
        </div>
        <div className="action-buttons" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar apariencia'}</button>
          <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw size={16} /> Restablecer</button>
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
