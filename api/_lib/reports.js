// Storage of forecast reports + e-mail rate limiting. Same interface for Supabase and memory (tests).
import { createHash, randomBytes } from 'node:crypto';

export const LIMITS = { perAddressPerDay: 3, perReport: 5, globalPerDay: 200 };

export function newToken() {
  return randomBytes(16).toString('base64url'); // 128-bit, URL safe
}

export function emailHash(email, salt = process.env.EMAIL_HASH_SALT || process.env.CRON_SECRET || 'future-jobs') {
  return createHash('sha256').update(`${salt}:${String(email).trim().toLowerCase()}`).digest('hex');
}

export function isValidEmail(email) {
  const e = String(email || '').trim();
  return e.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(e);
}

export const isValidToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t);

const check = ({ error, data }, what) => {
  if (error) throw new Error(`DB ${what}: ${error.message}`);
  return data;
};

export function createSupabaseReports(db) {
  return {
    async save(row) { check(await db.from('quiz_reports').insert(row), 'insert report'); },
    async get(token) {
      const rows = check(await db.from('quiz_reports').select('token, report, created_at, expires_at').eq('token', token).limit(1), 'select report');
      const r = rows[0];
      return r && Date.parse(r.expires_at) > Date.now() ? r : null;
    },
    async listForUser(userId, limit = 10) {
      return check(await db.from('quiz_reports').select('token, created_at, report->top_category_label, report->data_date')
        .eq('user_id', userId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(limit), 'list reports');
    },
    async countSends({ hash, token, since }) {
      const count = async (q) => { const { count, error } = await q; if (error) throw new Error(`DB count: ${error.message}`); return count || 0; };
      const base = () => db.from('email_log').select('*', { count: 'exact', head: true }).eq('status', 'sent');
      return {
        address: await count(base().eq('email_hash', hash).gte('sent_at', since)),
        report: await count(base().eq('report_token', token)),
        global: await count(base().gte('sent_at', since)),
      };
    },
    async logSend(row) { check(await db.from('email_log').insert(row), 'insert email_log'); },
  };
}

export function createMemoryReports() {
  const reports = new Map();
  const log = [];
  return {
    _reports: reports,
    _log: log,
    async save(row) { reports.set(row.token, { ...row, created_at: row.created_at || new Date().toISOString(), expires_at: new Date(Date.now() + 63072000000).toISOString() }); },
    async get(token) { return reports.get(token) || null; },
    async listForUser(userId) {
      return [...reports.values()].filter((r) => r.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({ token: r.token, created_at: r.created_at, top_category_label: r.report.top_category_label, data_date: r.report.data_date }));
    },
    async countSends({ hash, token, since }) {
      const sent = log.filter((l) => l.status === 'sent');
      return {
        address: sent.filter((l) => l.email_hash === hash && l.sent_at >= since).length,
        report: sent.filter((l) => l.report_token === token).length,
        global: sent.filter((l) => l.sent_at >= since).length,
      };
    },
    async logSend(row) { log.push({ sent_at: new Date().toISOString(), ...row }); },
  };
}

/** Throws a user-facing error string if a send would exceed the limits. */
export async function checkSendLimits(reports, { hash, token, now = new Date() }) {
  const since = new Date(now.getTime() - 86400000).toISOString();
  const c = await reports.countSends({ hash, token, since });
  if (c.address >= LIMITS.perAddressPerDay) return 'Достигнат е лимитът от изпращания до този адрес за днес. Опитайте утре.';
  if (c.report >= LIMITS.perReport) return 'Тази прогноза вече е изпращана няколко пъти. Използвайте линка в предишния имейл.';
  if (c.global >= LIMITS.globalPerDay) return 'Дневният лимит за имейли на сайта е достигнат. Опитайте утре или запазете линка.';
  return null;
}
