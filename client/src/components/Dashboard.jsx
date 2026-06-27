import { useState, useEffect, useCallback } from 'react';
import {
  Play, HardDrive, Cpu, MemoryStick, Container, Layers, CircuitBoard,
} from 'lucide-react';
import { api } from '../api';
import { Loading, ConnectionBanner, StateBadge, useSilentLoad, RefreshIndicator } from './shared';
import HardwareModal from './HardwareModal';
import { MetricAreaChart, MetricBarChart } from './Charts';
import { useMetricHistory } from '../hooks/useMetricHistory';

export default function Dashboard({ connected, config }) {
  const [info, setInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [stacks, setStacks] = useState([]);
  const [containers, setContainers] = useState([]);
  const [host, setHost] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const { initialLoading, refreshing, run } = useSilentLoad();

  const load = useCallback(() => run(async () => {
    try {
      const hostData = await api.getHostSystem();
      setHost(hostData);
      if (connected) {
        const [infoData, statsData, containersData, stacksData] = await Promise.all([
          api.getInfo(),
          api.getStats(),
          api.getContainers(),
          api.getStacks().catch(() => []),
        ]);
        setInfo(infoData);
        setStats(statsData);
        setContainers(containersData.slice(0, 10));
        setStacks(stacksData.slice(0, 5));
      }
    } catch { /* ignore */ }
  }), [connected, run]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!config?.autoRefresh) return;
    const id = setInterval(load, config.refreshInterval);
    return () => clearInterval(id);
  }, [load, config]);

  const hostHistory = useMetricHistory(async () => {
    const live = await api.getHostLive();
    return {
      cpu: parseFloat(live?.cpu?.overall ?? 0),
      ram: parseFloat(live?.memory?.usedPercent ?? 0),
    };
  }, config?.refreshInterval || 5000, 24, connected);

  const containerBarData = containers.slice(0, 6).map((c) => ({
    name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
    estado: c.state === 'running' ? 1 : 0,
  }));

  if (initialLoading) return <Loading />;

  const mainDisk = host?.disks?.[0];
  const hasGpu = host?.gpus?.length > 0;
  const cards = [
    { id: 'memory', label: 'RAM usada', value: `${host?.memory?.usedPercent ?? '—'}%`, sub: `${host?.memory?.usedFormatted} / ${host?.memory?.totalFormatted}`, color: '#8b5cf6', Icon: MemoryStick, clickable: true },
    { id: 'disk', label: mainDisk ? `Disco ${mainDisk.mount}` : 'Disco principal', value: mainDisk ? `${mainDisk.usedPercent}%` : '—', sub: mainDisk ? `${mainDisk.freeFormatted} libres` : '—', color: '#f59e0b', Icon: HardDrive, clickable: true },
    { id: 'cpu', label: 'CPU', value: host?.cpu?.cores ?? '—', sub: host?.cpu?.model?.split(' ').slice(0, 4).join(' ') ?? '', color: '#3b82f6', Icon: Cpu, clickable: true },
    ...(hasGpu ? [{ id: 'gpu', label: 'GPU', value: host.gpus[0].vendor, sub: host.gpus[0].name.split(' ').slice(0, 3).join(' '), color: '#22c55e', Icon: CircuitBoard, clickable: true }] : []),
    { id: null, label: 'Contenedores activos', value: stats?.containers?.running ?? '—', sub: `${stats?.containers?.total ?? 0} en total`, color: '#22c55e', Icon: Play, clickable: false },
    { id: null, label: 'Imágenes', value: stats?.images?.total ?? '—', sub: stats?.images?.totalSizeFormatted ?? '', color: '#13b6ec', Icon: HardDrive, clickable: false },
    { id: null, label: 'Stacks', value: stacks.length, sub: 'Compose projects', color: '#6366f1', Icon: Layers, clickable: false },
    { id: 'docker', label: 'Docker', value: info?.info?.serverVersion ?? '—', sub: connected ? (info?.info?.name ?? 'Conectado') : 'Sin conexión', color: '#2496ed', Icon: Container, clickable: true },
  ];

  return (
    <div>
      <ConnectionBanner connected={connected} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <RefreshIndicator active={refreshing} />
      </div>

      <div className="stats-grid">
        {cards.map((c) => {
          const Tag = c.clickable ? 'button' : 'div';
          return (
            <Tag
              key={c.label}
              type={c.clickable ? 'button' : undefined}
              className={`stat-card ${c.clickable ? 'stat-card-clickable' : ''}`}
              onClick={c.clickable && c.id ? () => setDetailType(c.id) : undefined}
            >
              <div className="stat-icon" style={{ background: `${c.color}18`, color: c.color }}>
                <c.Icon size={22} strokeWidth={2} />
              </div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-sub">{c.sub}</div>
              {c.clickable && <span className="stat-tap-hint">Ver detalle</span>}
            </Tag>
          );
        })}
      </div>

      <HardwareModal
        open={!!detailType}
        type={detailType}
        onClose={() => setDetailType(null)}
        host={host}
        dockerInfo={info}
        connected={connected}
      />

      <div className="charts-row">
        <div className="panel flex-1">
          <div className="panel-header"><Cpu size={16} /><h3>Uso del sistema en tiempo real</h3></div>
          <div className="panel-body">
            <MetricAreaChart
              data={hostHistory}
              lines={[
                { key: 'cpu', name: 'CPU %', color: '#3b82f6' },
                { key: 'ram', name: 'RAM %', color: '#8b5cf6' },
              ]}
              height={240}
            />
          </div>
        </div>
        <div className="panel flex-1">
          <div className="panel-header"><Container size={16} /><h3>Estado de contenedores</h3></div>
          <div className="panel-body">
            <MetricBarChart
              data={containerBarData}
              bars={[{ key: 'estado', name: 'Activo', color: 'var(--accent)' }]}
              height={240}
            />
          </div>
        </div>
      </div>

      <div className="dashboard-panels">
        <div className="panel flex-1">
          <div className="panel-header"><Container size={16} /><h3>Contenedores recientes</h3></div>
          <div className="panel-body panel-body-flush">
            {containers.length === 0 ? (
              <div className="empty-state compact">No hay contenedores</div>
            ) : (
              <table>
                <thead><tr><th>Nombre</th><th>Imagen</th><th>Estado</th><th>Puertos</th></tr></thead>
                <tbody>
                  {containers.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td className="mono cell-muted">{c.image}</td>
                      <td><StateBadge state={c.state} /></td>
                      <td className="mono">{c.ports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="panel flex-1">
          <div className="panel-header"><Layers size={16} /><h3>Stacks</h3></div>
          <div className="panel-body panel-body-flush">
            {stacks.length === 0 ? (
              <div className="empty-state compact">No hay stacks desplegados</div>
            ) : (
              <table>
                <thead><tr><th>Nombre</th><th>Estado</th><th>Contenedores</th></tr></thead>
                <tbody>
                  {stacks.map((s) => (
                    <tr key={s.name}>
                      <td><strong>{s.name}</strong></td>
                      <td><StateBadge state={s.status === 'active' ? 'running' : 'exited'} /></td>
                      <td>{s.runningCount}/{s.containerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
