// "Кариерна прогноза" API (one function to stay well within Vercel's function limits).
//   POST { action: 'create', answers }                 -> { token, report }   (saves the report)
//   GET  ?token=...                                    -> { report, created_at }
//   GET  ?mine=1   (Authorization: Bearer <session>)   -> { reports: [...] }  (signed-in user's reports)
//   POST { action: 'email', token, email, consent }    -> { sent: true }      (Resend; address not stored)
import { getUserFromRequest } from './_lib/auth.js';
import { renderForecastEmail, sendWithResend } from './_lib/email.js';
import { buildForecast } from './_lib/forecast.js';
import { validateAnswers, QUIZ_VERSION } from './_lib/quiz-data.js';
import { checkSendLimits, createSupabaseReports, emailHash, isValidEmail, isValidToken, newToken } from './_lib/reports.js';
import { buildOccupationGroups, skillsByIsco2 } from './_lib/snapshot.js';
import { createServiceClient, createSupabaseStore } from './_lib/store.js';

export async function loadForecastInputs(store) {
  const [skills, scores, sources, lfs, forecasts, skillOcc] = await Promise.all([
    store.getSkills(), store.getLatestScores(), store.getSources(), store.getStatSeries('lfsa_egai2d'), store.getForecasts(), store.getSkillOccupations(),
  ]);
  return { skills, scores, sources, occupationGroups: buildOccupationGroups(lfs, forecasts, skillsByIsco2(skills, skillOcc)) };
}

export async function handleForecast(req, res, { db, store, reports, getUser = (r) => getUserFromRequest(r, db), send = sendWithResend } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (!store || !reports) return res.status(503).json({ error: 'Прогнозата временно не е достъпна (няма връзка с базата данни).' });

  if (req.method === 'GET') {
    if (req.query?.mine === '1') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Влезте в профила си.' });
      return res.status(200).json({ reports: await reports.listForUser(user.id) });
    }
    const token = req.query?.token;
    if (!isValidToken(token)) return res.status(400).json({ error: 'Невалиден линк.' });
    const row = await reports.get(token);
    if (!row) return res.status(404).json({ error: 'Прогнозата не е намерена или е изтекла.' });
    return res.status(200).json({ token, report: row.report, created_at: row.created_at });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });

  const body = req.body || {};
  if (body.action === 'create') {
    const inputs = await loadForecastInputs(store);
    if (!inputs.scores.length) return res.status(503).json({ error: 'Пазарните данни още не са заредени. Опитайте отново по-късно.' });
    const { answers, error } = validateAnswers(body.answers, new Set(inputs.skills.map((s) => s.id)));
    if (error) return res.status(400).json({ error });
    const report = buildForecast({ answers, snapshot: inputs });
    const token = newToken();
    const user = await getUser(req).catch(() => null);
    await reports.save({ token, user_id: user?.id ?? null, version: QUIZ_VERSION, answers, report });
    return res.status(200).json({ token, report });
  }

  if (body.action === 'email') {
    if (!isValidToken(body.token)) return res.status(400).json({ error: 'Невалидна прогноза.' });
    if (!isValidEmail(body.email)) return res.status(400).json({ error: 'Невалиден имейл адрес.' });
    if (body.consent !== true) return res.status(400).json({ error: 'Потвърдете, че искате да получите прогнозата по имейл.' });
    const row = await reports.get(body.token);
    if (!row) return res.status(404).json({ error: 'Прогнозата не е намерена или е изтекла.' });
    const hash = emailHash(body.email);
    const limitError = await checkSendLimits(reports, { hash, token: body.token });
    if (limitError) return res.status(429).json({ error: limitError });
    const mail = renderForecastEmail(row.report, body.token);
    const result = await send({ to: String(body.email).trim(), ...mail, idempotencyKey: `${body.token}:${hash.slice(0, 16)}:${new Date().toISOString().slice(0, 13)}` });
    if (result.notConfigured) return res.status(503).json({ error: 'Изпращането по имейл още не е настроено. Запазете линка към прогнозата.' });
    await reports.logSend({ report_token: body.token, email_hash: hash, status: result.ok ? 'sent' : 'failed' });
    if (!result.ok) return res.status(502).json({ error: 'Имейлът не можа да бъде изпратен. Опитайте отново по-късно.' });
    return res.status(200).json({ sent: true });
  }
  return res.status(400).json({ error: 'Unknown action' });
}

export default async function handler(req, res) {
  const db = createServiceClient();
  try {
    return await handleForecast(req, res, { db, store: db && createSupabaseStore(db), reports: db && createSupabaseReports(db) });
  } catch (e) {
    console.error('[forecast]', e);
    return res.status(500).json({ error: 'Възникна грешка. Опитайте отново.' });
  }
}
