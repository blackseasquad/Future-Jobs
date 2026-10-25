import { supabase } from './supabase';
import type { Horizon, OccupationGroup } from './marketData';

export type Answers = Record<string, string | string[]>;

export interface ForecastReport {
  version: string;
  created_at: string;
  data_date: string | null;
  region: string;
  top_category: string | null;
  top_category_label: string | null;
  summary: { question: string; answer: string }[];
  groups: (Pick<OccupationGroup, 'isco2' | 'label_bg' | 'eurostat' | 'cedefop'> & { fit: number; data_percentile: number; skills_matched: string[] })[];
  careers: { id: string; title: string; category: string; category_label: string; skills: string[] }[];
  horizons: Record<'short' | 'medium' | 'long', Horizon>;
  plan: { hours_per_week: number; months_per_skill: number; text: string; tip: string; note: string };
  limitations: string[];
}

export interface SavedForecast {
  token: string;
  report: ForecastReport;
}

const STORAGE_KEY = 'future_jobs_forecast';

export function readSavedForecast(): SavedForecast | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return v?.token && v?.report ? v : null;
  } catch {
    return null;
  }
}

export function writeSavedForecast(v: SavedForecast | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { authorization: `Bearer ${t}` } : {};
}

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Грешка ${res.status}`);
  return body as T;
}

export async function createForecast(answers: Answers): Promise<SavedForecast> {
  return call('/api/forecast', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ action: 'create', answers }),
  });
}

export async function getForecast(token: string): Promise<SavedForecast> {
  return call(`/api/forecast?token=${encodeURIComponent(token)}`);
}

export async function myForecasts(): Promise<{ token: string; created_at: string }[]> {
  const headers = await authHeader();
  if (!headers.authorization) return [];
  const r = await call<{ reports: { token: string; created_at: string }[] }>('/api/forecast?mine=1', { headers });
  return r.reports;
}

export async function emailForecast(token: string, email: string): Promise<void> {
  await call('/api/forecast', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'email', token, email, consent: true }),
  });
}

export const reportUrl = (token: string) => `${window.location.origin}/?report=${encodeURIComponent(token)}`;
