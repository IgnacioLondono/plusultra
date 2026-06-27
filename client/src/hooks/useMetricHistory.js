import { useState, useEffect, useRef } from 'react';

export function useMetricHistory(fetcher, interval = 3000, maxPoints = 30, enabled = true) {
  const [data, setData] = useState([]);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const point = await fetcherRef.current();
        if (cancelled || !point) return;
        setData((prev) => {
          const next = [...prev, { ...point, t: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }];
          return next.length > maxPoints ? next.slice(-maxPoints) : next;
        });
      } catch { /* ignore */ }
    };

    tick();
    const id = setInterval(tick, interval);
    return () => { cancelled = true; clearInterval(id); };
  }, [interval, maxPoints, enabled]);

  return data;
}
