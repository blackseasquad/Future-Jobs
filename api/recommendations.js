// Personalised skill recommendations (no personal data is stored by this endpoint).
// Body: { knownSkills: string[], favoriteCareerIds: string[], quizCategory?: string, explain?: boolean }
import { explainRecommendations } from './_lib/ai.js';
import { buildRecommendations } from './_lib/recommend.js';
import { createReadClient, createSupabaseStore } from './_lib/store.js';

const asIds = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length < 64).slice(0, 50) : []);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const db = createReadClient();
  if (!db) return res.status(200).json({ configured: false });

  const body = req.body || {};
  const profile = {
    knownSkills: asIds(body.knownSkills),
    favoriteCareerIds: asIds(body.favoriteCareerIds),
    quizCategory: ['ai', 'green', 'biomed', 'space', 'meta'].includes(body.quizCategory) ? body.quizCategory : null,
  };
  try {
    const store = createSupabaseStore(db);
    const [skills, scores, sources] = await Promise.all([store.getSkills(), store.getLatestScores(), store.getSources()]);
    if (!scores.length) return res.status(200).json({ configured: true, ready: false, horizons: null });
    const horizons = buildRecommendations({ skills, scores, sources, profile });
    const ai = body.explain === true ? await explainRecommendations(horizons) : null;
    return res.status(200).json({ configured: true, ready: true, computedDate: scores[0].computed_date, horizons, ai });
  } catch (e) {
    console.error('[recommendations]', e);
    return res.status(500).json({ error: 'Препоръките временно не са достъпни.' });
  }
}
