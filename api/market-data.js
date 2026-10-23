// Public read-only labour-market snapshot used by the UI.
import { buildSnapshot } from './_lib/snapshot.js';
import { createReadClient, createSupabaseStore } from './_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const db = createReadClient();
  if (!db) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ configured: false });
  }
  try {
    const snapshot = await buildSnapshot(createSupabaseStore(db));
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(snapshot);
  } catch (e) {
    console.error('[market-data]', e);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Данните временно не са достъпни.' });
  }
}
