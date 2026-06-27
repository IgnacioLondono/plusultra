import { useState, useEffect, useCallback } from 'react';
import {
  Server, Cpu, HardDrive, Container, MemoryStick, Monitor, RefreshCw, Disc3, CircuitBoard,
} from 'lucide-react';
import { api } from '../api';
import { Loading, ConnectionBanner, useSilentLoad, RefreshIndicator } from './shared';
import HardwareModal, { ClickableSpecCard } from './HardwareModal';
import { MetricBarChart } from './Charts';

function UsageBar({ percent, color }) {
  const p = Math.min(100, Math.max(0, parseFloat(percent) || 0));
  const barColor = p >= 90 ? 'var(--danger)' : p >= 75 ? 'var(--warning)' : color || 'var(--accent)';
  return (
    <div className="usage-bar">
      <div className="usage-bar-track">
        <div className="usage-bar-fill" style={{ width: `${p}%`, background: barColor }} />
      </div>
      <span className="usage-bar-label">{p}%</span>
    </div>
  );
}

export default function SystemInfo({ connected, config }) {
  const [dockerInfo, setDockerInfo] = useState(null);
  const [host, setHost] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const { initialLoading, refreshing, run } = useSilentLoad();

  const load = useCallback(() => run(async () => {
    try {
      const hostData = await api.getHostSystem();
      setHost(hostData);
      if (connected) {
        setDockerInfo(await api.getInfo());
      }
    } catch { /* ignore */ }
  }), [connected, run]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!config?.autoRefresh) return;
    const id = setInterval(load, config.refreshInterval);
    return () => clearInterval(id);
  }, [load, config]);

  if (initialLoading) return <Loading />;

  const i = dockerInfo?.info;

  return (
    <div>
      <ConnectionBanner connected={connected} />

      <p className="spec-hint">Pulsa una tarjeta para ver el detalle en tiempo real</p>
      <div className="spec-hero-grid">
        <ClickableSpecCard onClick={() => setDetailType('cpu')}>
          <div className="spec-hero-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <Cpu size={22} />
          </div>
          <div className="spec-hero-body">
            <div className="spec-hero-label">Procesador</div>
            <div className="spec-hero-value">{host?.cpu?.cores} núcleos</div>
            <div className="spec-hero-sub">{host?.cpu?.model}</div>
            <div className="spec-hero-meta">{host?.cpu?.speed} · {host?.cpu?.arch}</div>
          </div>
        </ClickableSpecCard>

        <ClickableSpecCard onClick={() => setDetailType('memory')}>
          <div className="spec-hero-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <MemoryStick size={22} />
          </div>
          <div className="spec-hero-body">
            <div className="spec-hero-label">Memoria RAM</div>
            <div className="spec-hero-value">{host?.memory?.usedFormatted} / {host?.memory?.totalFormatted}</div>
            <UsageBar percent={host?.memory?.usedPercent} color="#8b5cf6" />
            <div className="spec-hero-meta">Libre: {host?.memory?.freeFormatted}</div>
          </div>
        </ClickableSpecCard>

        {(host?.gpus?.length > 0) && (
          <ClickableSpecCard onClick={() => setDetailType('gpu')}>
            <div className="spec-hero-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
              <CircuitBoard size={22} />
            </div>
            <div className="spec-hero-body">
              <div className="spec-hero-label">Gráfica</div>
              <div className="spec-hero-value">{host.gpus[0].name.split(' ').slice(0, 3).join(' ')}</div>
              <div className="spec-hero-sub">{host.gpus.length} GPU{host.gpus.length > 1 ? 's' : ''} · {host.gpus[0].vendor}</div>
              <div className="spec-hero-meta">VRAM: {host.gpus[0].vram}</div>
            </div>
          </ClickableSpecCard>
        )}

        <ClickableSpecCard onClick={() => setDetailType('disk')}>
          <div className="spec-hero-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <HardDrive size={22} />
          </div>
          <div className="spec-hero-body">
            <div className="spec-hero-label">Almacenamiento</div>
            <div className="spec-hero-value">{host?.disks?.length ?? 0} discos</div>
            <div className="spec-hero-sub">
              {host?.disks?.[0] ? `${host.disks[0].mount} · ${host.disks[0].usedPercent}% usado` : '—'}
            </div>
            <div className="spec-hero-meta">Pulsa para ver todos los discos</div>
          </div>
        </ClickableSpecCard>

        <ClickableSpecCard onClick={() => setDetailType('os')}>
          <div className="spec-hero-icon" style={{ background: 'rgba(19,182,236,0.15)', color: 'var(--accent)' }}>
            <Monitor size={22} />
          </div>
          <div className="spec-hero-body">
            <div className="spec-hero-label">Sistema operativo</div>
            <div className="spec-hero-value">{host?.host?.hostname}</div>
            <div className="spec-hero-sub">{host?.host?.osLabel}</div>
            <div className="spec-hero-meta">Activo: {host?.host?.uptimeFormatted}</div>
          </div>
        </ClickableSpecCard>

        {connected && (
          <ClickableSpecCard onClick={() => setDetailType('docker')}>
            <div className="spec-hero-icon" style={{ background: 'rgba(36,150,237,0.15)', color: '#2496ed' }}>
              <Container size={22} />
            </div>
            <div className="spec-hero-body">
              <div className="spec-hero-label">Docker</div>
              <div className="spec-hero-value">{dockerInfo?.info?.serverVersion ?? '—'}</div>
              <div className="spec-hero-sub">{dockerInfo?.info?.containersRunning ?? 0} contenedores activos</div>
              <div className="spec-hero-meta">{dockerInfo?.info?.images ?? 0} imágenes</div>
            </div>
          </ClickableSpecCard>
        )}
      </div>

      <HardwareModal
        open={!!detailType}
        type={detailType}
        onClose={() => setDetailType(null)}
        host={host}
        dockerInfo={dockerInfo}
        connected={connected}
      />

      {/* Disks */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <HardDrive size={18} />
          <h3>Discos y almacenamiento</h3>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={load}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <RefreshIndicator active={refreshing} />
        </div>
        <div className="panel-body panel-body-flush">
          {!host?.disks?.length ? (
            <div className="empty-state compact">No se detectaron discos</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Unidad / Montaje</th>
                  <th>Sistema de archivos</th>
                  <th>Total</th>
                  <th>Usado</th>
                  <th>Libre</th>
                  <th>Uso</th>
                </tr>
              </thead>
              <tbody>
                {host.disks.map((d) => (
                  <tr key={d.mount}>
                    <td>
                      <div className="disk-name">
                        <Disc3 size={14} />
                        <strong>{d.label}</strong>
                      </div>
                    </td>
                    <td className="mono cell-muted">{d.filesystem}</td>
                    <td>{d.totalFormatted}</td>
                    <td>{d.usedFormatted}</td>
                    <td>{d.freeFormatted}</td>
                    <td style={{ minWidth: 140 }}>
                      <UsageBar percent={d.usedPercent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Docker disk usage */}
      {host?.dockerDisk?.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <Container size={18} />
            <h3>Espacio Docker</h3>
          </div>
          <div className="panel-body panel-body-flush">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Total</th><th>Activos</th><th>Recuperable</th><th>Cantidad</th></tr>
              </thead>
              <tbody>
                {host.dockerDisk.map((d) => (
                  <tr key={d.type}>
                    <td><span className="badge badge-created">{d.type}</span></td>
                    <td><strong>{d.total}</strong></td>
                    <td>{d.active}</td>
                    <td className="cell-muted">{d.reclaimable}</td>
                    <td>{d.totalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panels */}
      <div className="system-grid">
        <div className="panel">
          <div className="panel-header"><Server size={18} /><h3>Motor Docker</h3></div>
          <div className="panel-body panel-body-flush">
            <table className="info-table">
              <tbody>
                {[
                  { label: 'Versión', value: i?.serverVersion },
                  { label: 'Nodo', value: i?.name },
                  { label: 'SO Docker', value: i?.operatingSystem },
                  { label: 'Arquitectura', value: i?.architecture },
                  { label: 'CPUs (Docker)', value: i?.cpus },
                  { label: 'RAM (Docker)', value: i?.memoryTotalFormatted },
                  { label: 'Directorio raíz', value: i?.dockerRootDir },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="info-label">{row.label}</td>
                    <td className="info-value">{row.value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><Container size={18} /><h3>Inventario Docker</h3></div>
          <div className="panel-body panel-body-flush">
            <table className="info-table">
              <tbody>
                {[
                  { label: 'Contenedores', value: i?.containers },
                  { label: 'En ejecución', value: i?.containersRunning },
                  { label: 'Pausados', value: i?.containersPaused },
                  { label: 'Detenidos', value: i?.containersStopped },
                  { label: 'Imágenes', value: i?.images },
                  { label: 'Node.js', value: host?.host?.nodeVersion },
                  { label: 'Uptime host', value: host?.host?.uptimeFormatted },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="info-label">{row.label}</td>
                    <td className="info-value">{row.value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContainerStats({ connected, addToast, config }) {
  const [containers, setContainers] = useState([]);
  const { initialLoading, refreshing, run } = useSilentLoad();

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try {
      const list = await api.getContainers();
      const running = list.filter((c) => c.state === 'running');
      const stats = await Promise.all(
        running.slice(0, 20).map(async (c) => {
          try {
            const detail = await api.getContainer(c.id);
            return { ...c, stats: detail.stats };
          } catch {
            return { ...c, stats: null };
          }
        })
      );
      setContainers(stats);
    } catch (e) { addToast(e.message, 'error'); }
  }), [connected, addToast, run]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!config?.autoRefresh || !connected) return;
    const id = setInterval(load, config.refreshInterval);
    return () => clearInterval(id);
  }, [load, config, connected]);

  const chartData = containers.map((c) => ({
    name: c.name.length > 10 ? `${c.name.slice(0, 10)}…` : c.name,
    cpu: parseFloat(c.stats?.cpuPercent) || 0,
    mem: parseFloat(c.stats?.memPercent) || 0,
  }));

  if (initialLoading) return <Loading />;

  return (
    <div>
      {containers.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><Container size={16} /><h3>Gráficos de uso por contenedor</h3></div>
          <div className="panel-body">
            <MetricBarChart
              data={chartData}
              bars={[
                { key: 'cpu', name: 'CPU %', color: '#3b82f6' },
                { key: 'mem', name: 'Memoria %', color: '#8b5cf6' },
              ]}
              height={280}
            />
          </div>
        </div>
      )}

    <div className="table-wrap">
      <div className="table-toolbar">
        <span className="toolbar-count">Uso de recursos — contenedores activos</span>
        <RefreshIndicator active={refreshing} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>Actualizar</button>
      </div>
      {containers.length === 0 ? (
        <div className="empty-state"><Container size={40} /><p>No hay contenedores en ejecución</p></div>
      ) : (
        <table>
          <thead>
            <tr><th>Contenedor</th><th>CPU %</th><th>Memoria</th><th>Mem %</th><th>Imagen</th></tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.stats?.cpuPercent ?? '—'}%</td>
                <td>{c.stats ? `${c.stats.memUsageFormatted} / ${c.stats.memLimitFormatted}` : '—'}</td>
                <td>{c.stats?.memPercent ?? '—'}%</td>
                <td className="mono cell-muted">{c.image}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </div>
  );
}
