// Daily data refresh, invoked by Vercel Cron (see vercel.json).
// Vercel cron schedules are in UTC, so two entries (03:00 and 04:00 UTC) are configured. The one that
// falls before 06:00 Europe/Sofia is skipped; the first one at/after 06:00 runs. A second same-day
// invocation is a no-op (or a catch-up if the first one was missed or failed). Works in summer and winter time.
// Protected by CRON_SECRET: Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically.

import { isAuthorizedCron } from '../_lib/auth.js';
import { runRefresh } from '../_lib/pipeline.js';
import { createServiceClient, createSupabaseStore } from '../_lib/store.js';
import { isDueInSofia, sofiaClock } from '../_lib/util.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  if (!process.env.CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  if (!isAuthorizedCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServiceClient();
  if (!db) return res.status(503).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured' });

  const now = new Date();
  const force = req.query?.force === '1';
  if (!force && !isDueInSofia(now)) {
    return res.status(200).json({ status: 'skipped', reason: 'before_06_Europe/Sofia', sofia: sofiaClock(now),
      schedule: req.headers?.['x-vercel-cron-schedule'] || null });
  }

  try {
    const result = await runRefresh({ store: createSupabaseStore(db), now, trigger: force ? 'manual' : 'cron', force });
    return res.status(result.status === 'failed' ? 502 : 200).json(result);
  } catch (e) {
    console.error('[cron] refresh crashed', e);
    return res.status(500).json({ status: 'failed', error: 'Refresh crashed; previous data kept. See function logs.' });
  }
}
