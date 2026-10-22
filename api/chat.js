// Serverless proxy (Vercel / Netlify-style) for the Gemini API (Google AI Studio key).
// Env vars: GEMINI_API_KEY (required), GEMINI_MODEL (optional)
import { SITE_KNOWLEDGE } from "./_site-knowledge.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const SYSTEM = `You are the assistant on the FUTURE-JOBS website. Answer visitors' questions about the website using ONLY the information below.
Be brief, friendly and clear (usually 1-4 sentences). If the answer is not covered below, say you're not sure and point them to the relevant section of the site. Do not invent features, numbers, salaries, or job listings. Reply in Bulgarian unless the visitor writes in another language.

--- WEBSITE INFORMATION ---
${SITE_KNOWLEDGE}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { messages, page } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "No messages" });

  const contents = messages.slice(-10).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, 500) }]
  }));

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM + `\n\nThe visitor is currently viewing this section of the site: ${String(page || "unknown").slice(0, 100)}` }] },
        contents,
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 }
      })
    });
    const data = await r.json();
    if (!r.ok) { console.error("Gemini error:", JSON.stringify(data)); return res.status(502).json({ error: "Upstream error" }); }
    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!reply) return res.status(502).json({ error: "Empty reply" });
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
