import { timingSafeEqual } from 'node:crypto';
import { createServiceClient } from './store.js';

/** Constant-time comparison of "Authorization: Bearer <secret>" against CRON_SECRET. */
export function isAuthorizedCron(req, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 16) return false; // fail closed when not configured
  const header = String(req.headers?.authorization || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Signed-in Supabase user from "Authorization: Bearer <access token>", or null. */
export async function getUserFromRequest(req, db = createServiceClient()) {
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !db) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data?.user ?? null;
}

/** Resolves the signed-in Supabase user from the bearer token and checks ADMIN_EMAILS. */
export async function getAdminUser(req) {
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { user: null, isAdmin: false };
  const db = createServiceClient();
  if (!db) return { user: null, isAdmin: false, error: 'not_configured' };
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return { user: null, isAdmin: false };
  const email = String(data.user.email || '').toLowerCase();
  return { user: data.user, isAdmin: Boolean(email) && adminEmails().includes(email) };
}
