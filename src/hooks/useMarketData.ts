import { useCallback, useEffect, useState } from 'react';
import { fetchMarketData, type MarketSnapshot } from '../lib/marketData';

// Loads the latest stored snapshot once per page view. The data itself is refreshed
// server-side by the daily cron job, not by the browser.
let cache: Promise<MarketSnapshot> | null = null;

export function useMarketData() {
  const [data, setData] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((force = false) => {
    if (force || !cache) cache = fetchMarketData();
    cache
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => {
        cache = null;
        setError('Пазарните данни временно не са достъпни.');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, reload: () => load(true) };
}
