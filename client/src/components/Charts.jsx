import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from 'recharts';

const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--text-secondary)' },
};

export function MetricAreaChart({ data, lines, height = 220 }) {
  if (!data?.length) {
    return <div className="chart-empty">Recopilando datos...</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {lines.map((l) => (
            <linearGradient key={l.key} id={`grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={l.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={l.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[0, 'auto']} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
        {lines.map((l) => (
          <Area
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            fill={`url(#grad-${l.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MetricLineChart({ data, lines, height = 200 }) {
  if (!data?.length) {
    return <div className="chart-empty">Recopilando datos...</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MetricBarChart({ data, bars, height = 220 }) {
  if (!data?.length) {
    return <div className="chart-empty">Sin datos</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
