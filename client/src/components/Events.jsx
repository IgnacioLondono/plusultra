import { useState, useEffect, useCallback } from 'react';
import { Radio, RefreshCw, Filter } from 'lucide-react';
import { api } from '../api';
import { Loading, useSilentLoad, RefreshIndicator } from './shared';

const TYPE_COLORS = {
  container: 'running',
  image: 'created',
  volume: 'paused',
  network: 'created',
  plugin: 'exited',
};

export default function Events({ connected, addToast }) {
  const [events, setEvents] = useState([]);
  const { initialLoading, refreshing, run } = useSilentLoad();
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [since, setSince] = useState(3600);

  const load = useCallback(() => run(async () => {
    if (!connected) return;
    try {
      setEvents(await api.getEvents(since));
    } catch (e) { addToast(e.message, 'error'); }
  }), [connected, since, addToast, run]);

  useEffect(() => { load(); }, [load]);

  const types = [...new Set(events.map((e) => e.type))];

  const filtered = events.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return e.actor.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  });

  if (initialLoading) return <Loading />;

  return (
    <div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-search">
            <Filter size={15} />
            <input placeholder="Filtrar eventos..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <select className="select-inline" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Todos los tipos</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="select-inline" value={since} onChange={(e) => setSince(parseInt(e.target.value))}>
            <option value={900}>Últimos 15 min</option>
            <option value={3600}>Última hora</option>
            <option value={86400}>Últimas 24 h</option>
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <RefreshIndicator active={refreshing} />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <Radio size={40} strokeWidth={1.2} />
            <p>No hay eventos en el periodo seleccionado</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Hora</th><th>Tipo</th><th>Acción</th><th>Recurso</th><th>Imagen</th></tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id + e.time}>
                  <td className="mono">{new Date(e.time).toLocaleString()}</td>
                  <td>
                    <span className={`badge badge-${TYPE_COLORS[e.type] || 'created'}`}>{e.type}</span>
                  </td>
                  <td><strong>{e.action}</strong></td>
                  <td className="mono">{e.actor}</td>
                  <td className="mono cell-muted">{e.image || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
