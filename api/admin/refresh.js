// Manual refresh for administrators (signed-in Supabase users listed in ADMIN_EMAILS).
// GET  -> { isAdmin }       POST -> runs the same pipeline as the cron job (forced).

import { getAdminUser } from '../_lib/auth.js';
import { runRefresh } from '../_lib/pipeline.js';
import { createServiceClient, createSupabaseStore } from '../_lib/store.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { isAdmin } = await getAdminUser(req);
  if (req.method === 'GET') return res.status(200).json({ isAdmin });
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const db = createServiceClient();
  if (!db) return res.status(503).json({ error: 'Database is not configured' });
  try {
    const result = await runRefresh({ store: createSupabaseStore(db), trigger: 'manual', force: true });
    return res.status(200).json(result);
  } catch (e) {
    console.error('[admin] refresh crashed', e);
    return res.status(500).json({ status: 'failed', error: 'Refresh crashed; previous data kept.' });
  }
}
