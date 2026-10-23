// Optional AI explanations. Reuses the project's existing Gemini setup (GEMINI_API_KEY / GEMINI_MODEL,
// same as api/chat.js). The model only receives facts already computed from real data and is told not
// to add numbers; any explanation containing digits is discarded, so AI text can never introduce statistics.

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

export function validateExplanation(text, allowedTokens = []) {
  const t = String(text || '').trim();
  if (!t || t.length > 600) return null;
  // Numbers must come from the data, never from the model. Digits that are part of a
  // skill name (e.g. "3D") are allowed.
  let probe = t;
  for (const tok of allowedTokens) probe = probe.split(tok).join('');
  if (/\d/.test(probe)) return null;
  return t;
}

export async function explainRecommendations(horizons, { fetchImpl = fetch } = {}) {
  if (!process.env.GEMINI_API_KEY) return { available: false, reason: 'AI обясненията не са конфигурирани (липсва GEMINI_API_KEY).' };

  const items = [];
  for (const [key, h] of Object.entries(horizons)) {
    for (const it of h.items) {
      items.push({
        id: `${key}:${it.skill_id}`, horizon: h.label, skill: it.label_bg,
        facts: it.facts.map((f) => f.text), forecasts: it.forecasts.map((f) => f.text),
        relevance: it.relevance.map((r) => r.type), next: it.next_skills.map((n) => n.label_bg), limitations: it.limitations,
      });
    }
  }
  if (!items.length) return { available: false, reason: 'Няма препоръки за обяснение.' };

  const prompt = `Ти си кариерен съветник в сайта FUTURE-JOBS. За всеки елемент напиши 2–3 изречения на български,
които обясняват защо умението е полезно за потребителя в посочения хоризонт и какво да научи след това.
ПРАВИЛА: използвай САМО дадените факти; НЕ пиши никакви числа, проценти или години; не измисляй статистики,
заплати или източници; ако фактите са оскъдни, кажи го. Отговори само с JSON обект {"<id>": "<обяснение>"}.

ДАННИ:
${JSON.stringify(items)}`;

  try {
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.3, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    if (!r.ok) return { available: false, reason: 'AI услугата върна грешка.' };
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const parsed = JSON.parse(text);
    const explanations = {};
    let rejected = 0;
    for (const it of items) {
      const allowed = [...it.skill.matchAll(/\S*\d\S*/g)].map((m) => m[0].replace(/[,.;]$/, ''));
      const ok = validateExplanation(parsed[it.id], allowed);
      if (ok) explanations[it.id] = ok;
      else if (parsed[it.id]) rejected++;
    }
    return { available: true, model: MODEL(), explanations, rejected };
  } catch {
    return { available: false, reason: 'AI обяснението не е налично в момента.' };
  }
}
