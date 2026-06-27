import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, MemoryStick, CircuitBoard, HardDrive, Monitor, Container, ChevronRight,
} from 'lucide-react';
import { api } from '../api';
import { Modal } from './shared';

const TITLES = {
  cpu: 'Procesador — núcleos en tiempo real',
  memory: 'Memoria RAM',
  gpu: 'Tarjetas gráficas',
  disk: 'Discos y almacenamiento',
  os: 'Sistema operativo',
  docker: 'Docker',
};

function UsageBar({ percent, color, small }) {
  const p = Math.min(100, Math.max(0, parseFloat(percent) || 0));
  const barColor = p >= 90 ? 'var(--danger)' : p >= 75 ? 'var(--warning)' : color || 'var(--accent)';
  return (
    <div className={`usage-bar ${small ? 'usage-bar-sm' : ''}`}>
      <div className="usage-bar-track">
        <div className="usage-bar-fill" style={{ width: `${p}%`, background: barColor }} />
      </div>
      <span className="usage-bar-label">{p}%</span>
    </div>
  );
}

export function ClickableSpecCard({ children, onClick, active }) {
  return (
    <button
      type="button"
      className={`spec-hero-card spec-hero-card-clickable ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {children}
      <ChevronRight size={16} className="spec-card-chevron" />
    </button>
  );
}

export default function HardwareModal({ open, type, onClose, host, dockerInfo, connected }) {
  const [live, setLive] = useState(null);

  const fetchLive = useCallback(async () => {
    try {
      setLive(await api.getHostLive());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open || !type) return;
    if (type === 'cpu' || type === 'gpu' || type === 'memory') {
      fetchLive();
      const id = setInterval(fetchLive, 1200);
      return () => clearInterval(id);
    }
  }, [open, type, fetchLive]);

  if (!type) return null;

  const cpuModel = host?.cpu?.model;
  const gpus = live?.gpus?.length ? live.gpus : host?.gpus || [];

  return (
    <Modal open={open} onClose={onClose} title={TITLES[type]} large>
      {type === 'cpu' && (
        <div className="hw-detail">
          <div className="hw-detail-header">
            <Cpu size={20} />
            <div>
              <strong>{cpuModel}</strong>
              <p className="cell-muted">{host?.cpu?.cores} núcleos · {host?.cpu?.speed} · Uso global: <strong>{live?.cpu?.overall ?? '—'}%</strong></p>
              {live?.loadAvg && (
                <p className="cell-muted">Carga media: {live.loadAvg.map((n) => n.toFixed(2)).join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="cores-grid">
            {(live?.cpu?.cores || []).map((core) => (
              <div key={core.core} className="core-cell">
                <div className="core-cell-header">
                  <span>Núcleo {core.core}</span>
                  <span className="core-usage">{core.usage}%</span>
                </div>
                <UsageBar percent={core.usage} color="#3b82f6" small />
                <span className="core-speed">{core.speed} MHz</span>
              </div>
            ))}
          </div>
          {!live?.cpu?.cores?.length && <p className="cell-muted">Midiendo núcleos...</p>}
        </div>
      )}

      {type === 'memory' && (
        <div className="hw-detail">
          <div className="hw-stat-row">
            <MemoryStick size={20} />
            <div style={{ flex: 1 }}>
              <div className="hw-big-value">{live?.memory?.usedFormatted || host?.memory?.usedFormatted} / {host?.memory?.totalFormatted}</div>
              <UsageBar percent={live?.memory?.usedPercent || host?.memory?.usedPercent} color="#8b5cf6" />
              <div className="hw-meta-grid">
                <div><span className="info-label">Usada</span><br />{live?.memory?.usedFormatted || host?.memory?.usedFormatted}</div>
                <div><span className="info-label">Libre</span><br />{live?.memory?.freeFormatted || host?.memory?.freeFormatted}</div>
                <div><span className="info-label">Total</span><br />{host?.memory?.totalFormatted}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {type === 'gpu' && (
        <div className="hw-detail">
          {gpus.length === 0 ? (
            <p className="cell-muted">No se detectó ninguna tarjeta gráfica dedicada.</p>
          ) : (
            gpus.map((gpu, i) => (
              <div key={gpu.index ?? i} className="gpu-card">
                <div className="hw-detail-header">
                  <CircuitBoard size={20} />
                  <div>
                    <strong>{gpu.name}</strong>
                    <p className="cell-muted">{gpu.vendor} · Driver {gpu.driver}</p>
                  </div>
                </div>
                <div className="hw-meta-grid">
                  {gpu.memTotal && <div><span className="info-label">VRAM total</span><br />{gpu.memTotal}</div>}
                  {gpu.memUsed && <div><span className="info-label">VRAM usada</span><br />{gpu.memUsed}</div>}
                  {gpu.memFree && <div><span className="info-label">VRAM libre</span><br />{gpu.memFree}</div>}
                  {gpu.vram && !gpu.memTotal && <div><span className="info-label">VRAM</span><br />{gpu.vram}</div>}
                  {gpu.gpuUtil && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="info-label">Uso GPU</span>
                      <UsageBar percent={parseFloat(gpu.gpuUtil)} color="#22c55e" />
                    </div>
                  )}
                  {gpu.memUtil && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="info-label">Uso memoria GPU</span>
                      <UsageBar percent={parseFloat(gpu.memUtil)} color="#a855f7" />
                    </div>
                  )}
                  {gpu.temperature && <div><span className="info-label">Temperatura</span><br />{gpu.temperature}</div>}
                  {gpu.power && <div><span className="info-label">Potencia</span><br />{gpu.power}</div>}
                  {gpu.fan && gpu.fan !== '[N/A]%' && <div><span className="info-label">Ventilador</span><br />{gpu.fan}</div>}
                  {gpu.processor && gpu.processor !== '—' && <div><span className="info-label">Procesador</span><br />{gpu.processor}</div>}
                  {gpu.status && <div><span className="info-label">Estado</span><br />{gpu.status}</div>}
                </div>
              </div>
            ))
          )}
          {gpus.length > 0 && !live?.gpus?.[0]?.gpuUtil && (
            <p className="form-hint" style={{ marginTop: 12 }}>
              Instala drivers NVIDIA y <code>nvidia-smi</code> para ver uso en tiempo real de la GPU.
            </p>
          )}
        </div>
      )}

      {type === 'disk' && (
        <div className="hw-detail">
          {(host?.disks || []).map((d) => (
            <div key={d.mount} className="disk-detail-row">
              <div className="hw-detail-header">
                <HardDrive size={18} />
                <div style={{ flex: 1 }}>
                  <strong>{d.label}</strong>
                  <p className="cell-muted">{d.filesystem} · {d.usedFormatted} usados de {d.totalFormatted}</p>
                  <UsageBar percent={d.usedPercent} color="#f59e0b" />
                  <p className="cell-muted">Libre: {d.freeFormatted}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {type === 'os' && (
        <div className="hw-detail">
          <table className="info-table" style={{ width: '100%' }}>
            <tbody>
              {[
                { label: 'Hostname', value: host?.host?.hostname },
                { label: 'Sistema', value: host?.host?.osLabel },
                { label: 'Plataforma', value: host?.host?.platform },
                { label: 'Uptime', value: host?.host?.uptimeFormatted },
                { label: 'Node.js', value: host?.host?.nodeVersion },
              ].map((r) => (
                <tr key={r.label}><td className="info-label">{r.label}</td><td className="info-value">{r.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'docker' && (
        <div className="hw-detail">
          {!connected ? (
            <p className="cell-muted">Docker no está conectado.</p>
          ) : (
            <table className="info-table" style={{ width: '100%' }}>
              <tbody>
                {[
                  { label: 'Versión', value: dockerInfo?.info?.serverVersion },
                  { label: 'Nodo', value: dockerInfo?.info?.name },
                  { label: 'Contenedores', value: dockerInfo?.info?.containers },
                  { label: 'En ejecución', value: dockerInfo?.info?.containersRunning },
                  { label: 'Imágenes', value: dockerInfo?.info?.images },
                  { label: 'CPUs (Docker)', value: dockerInfo?.info?.cpus },
                  { label: 'RAM (Docker)', value: dockerInfo?.info?.memoryTotalFormatted },
                ].map((r) => (
                  <tr key={r.label}><td className="info-label">{r.label}</td><td className="info-value">{r.value ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  );
}
