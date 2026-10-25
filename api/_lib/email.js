// Forecast e-mail: HTML/text rendering + sending through Resend (https://resend.com).
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. "FUTURE-JOBS <prognoza@your-domain.bg>"), PUBLIC_SITE_URL.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 1) => `${x > 0 ? '+' : ''}${Number(x).toFixed(d).replace('.', ',')}`;
const geoName = (g) => (g === 'EU27_2020' ? 'ЕС-27' : g === 'BG' ? 'България' : g);

export function siteUrl() {
  return (process.env.PUBLIC_SITE_URL || 'https://future-jobs-orcin.vercel.app').replace(/\/+$/, '');
}

export function reportLink(token) {
  return `${siteUrl()}/?report=${encodeURIComponent(token)}`;
}

export function renderForecastEmail(report, token) {
  const link = reportLink(token);
  const h = report.horizons || {};
  const groupHtml = (report.groups || []).map((g) => {
    const eu = g.eurostat?.EU27_2020;
    const bg = g.eurostat?.BG;
    const f = g.cedefop?.[0];
    const lines = [
      eu?.cagr_pct != null ? `ЕС-27: ${fmt(eu.cagr_pct)}% годишно (${esc(eu.from)}–${esc(eu.to)}, Eurostat)` : null,
      bg?.cagr_pct != null ? `България: ${fmt(bg.cagr_pct)}% годишно (Eurostat)` : null,
      f ? `Прогноза: ${fmt(f.annual_growth_pct)}% годишно до ${esc(f.period.split('–')[1])} (${esc(geoName(f.geo))}, Cedefop)` : null,
    ].filter(Boolean);
    return `<li style="margin-bottom:10px"><strong>${esc(g.label_bg)}</strong> <span style="color:#64748b">(ISCO-08 ${esc(g.isco2)})</span><br>${lines.map(esc).join('<br>')}</li>`;
  }).join('');
  const horizonHtml = ['short', 'medium', 'long'].map((k) => {
    const hz = h[k];
    if (!hz) return '';
    const items = hz.available ? hz.items.map((it) => `
      <li style="margin-bottom:12px"><strong>${esc(it.label_bg)}</strong>
        <ul style="margin:4px 0 0 0;padding-left:18px;color:#334155">
          ${[...it.facts, ...it.forecasts].map((f) => `<li>${esc(f.text)} <span style="color:#64748b">— ${esc(f.source)}${f.period ? `, ${esc(f.period)}` : ''}</span></li>`).join('')}
        </ul>
        ${it.learning?.length ? `<div style="margin-top:4px">Учете: ${it.learning.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</div>` : ''}
      </li>`).join('') : `<li style="color:#64748b">${esc(hz.reason || 'Няма достатъчно данни.')}</li>`;
    return `<h3 style="margin:18px 0 6px;font-size:16px;color:#0e7490">${esc(hz.label)}</h3><ol style="padding-left:18px;margin:0">${items}</ol>`;
  }).join('');
  const careers = (report.careers || []).map((c) => esc(c.title)).join(', ');

  const html = `<!doctype html><html lang="bg"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#0b0f19;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px">
      <div style="font-size:20px;font-weight:800;letter-spacing:1px">FUTURE-JOBS</div>
      <div style="font-size:14px;color:#94a3b8">Вашата кариерна прогноза · ${esc(new Date(report.created_at).toLocaleDateString('bg-BG'))}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;font-size:14px;line-height:1.55">
      <p>Ето прогнозата, която получихте след теста. Можете да я отворите отново по всяко време:</p>
      <p><a href="${esc(link)}" style="display:inline-block;background:#06b6d4;color:#020617;font-weight:700;padding:10px 16px;border-radius:8px;text-decoration:none">Отвори прогнозата</a></p>
      ${report.top_category_label ? `<p>Най-силно ви привлича: <strong>${esc(report.top_category_label)}</strong>.</p>` : ''}
      <h2 style="font-size:17px;margin:20px 0 8px">Групи професии, които ви подхождат</h2>
      <ol style="padding-left:18px;margin:0">${groupHtml || '<li>Няма достатъчно данни.</li>'}</ol>
      ${careers ? `<p style="margin-top:10px">Бъдещи професии за вдъхновение: ${careers}.</p>` : ''}
      <h2 style="font-size:17px;margin:22px 0 4px">Умения, които да развивате</h2>
      ${horizonHtml}
      <h2 style="font-size:17px;margin:22px 0 6px">Вашият ритъм на учене</h2>
      <p>${esc(report.plan?.text)} ${esc(report.plan?.tip)}</p>
      <p style="color:#64748b;font-size:12px;margin-top:20px">${(report.limitations || []).map(esc).join('<br>')}<br>
      Данни към ${esc(report.data_date || '—')}. Източници: Eurostat, Cedefop (CC BY 4.0), ESCO, Remotive, Arbeitnow, World Economic Forum.</p>
      <p style="color:#94a3b8;font-size:11px">Получавате този имейл, защото го поискахте на FUTURE-JOBS. Адресът ви не се съхранява и няма да получавате други съобщения.</p>
    </div>
  </div></body></html>`;

  const text = [
    'FUTURE-JOBS — Вашата кариерна прогноза',
    `Отвори прогнозата: ${link}`,
    '',
    'Групи професии:',
    ...(report.groups || []).map((g) => `- ${g.label_bg} (ISCO-08 ${g.isco2})`),
    '',
    ...['short', 'medium', 'long'].flatMap((k) => h[k] ? [`${h[k].label}:`, ...(h[k].available ? h[k].items.map((i) => `- ${i.label_bg}`) : [`- ${h[k].reason}`]), ''] : []),
    report.plan?.text || '',
  ].join('\n');

  return { subject: 'Вашата кариерна прогноза от FUTURE-JOBS', html, text };
}

export async function sendWithResend({ to, subject, html, text, idempotencyKey, fetchImpl = fetch }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, notConfigured: true };
  const r = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [to], subject, html, text, tags: [{ name: 'type', value: 'forecast' }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.error('[email] Resend error', r.status, body.slice(0, 300));
    return { ok: false, status: r.status };
  }
  return { ok: true, id: (await r.json().catch(() => ({}))).id || null };
}
