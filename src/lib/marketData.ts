import { supabase } from './supabase';

export type Confidence = 'high' | 'medium' | 'low' | 'insufficient';

export interface Component {
  raw: number | null;
  percentile: number | null;
  weight: number;
}

export interface ChangeFact {
  relative: number;
  absolute_pp: number;
  from: string;
  to: string;
  observations: number;
}

export interface ScoreInputs {
  demand: { share: number; ads_matching: number; ads_total: number; date: string } | null;
  change30: ChangeFact | null;
  change90: ChangeFact | null;
  long_term: { annual_growth_pct: number; period: string | null; edition: string | null; geo: string | null } | null;
  occupation_trend: { cagr_pct: number; period: string | null; geo: string | null } | null;
  occupations: { essential: number; optional: number };
  connectivity: number | null;
  related: { id: string; count: number }[];
}

export interface SkillData {
  id: string;
  label_bg: string;
  label_en: string;
  categories: string[];
  esco: { uri: string; label_bg: string | null; label_en: string | null; synonyms: string[] } | null;
  score: {
    value: number | null;
    confidence: Confidence;
    coverage: number;
    components: Record<string, Component>;
    inputs: ScoreInputs;
    computed_date: string;
  } | null;
  wef: string | null;
  history: { date: string; share: number; ads_total: number }[];
}

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  license: string | null;
  kind: string;
  update_frequency: string | null;
  last_status: string | null;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  data_period: string | null;
  source_updated_at: string | null;
  records_last_run: number | null;
}

export interface RunInfo {
  id: number;
  run_key: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  sources: Record<string, string | null>;
}

export interface MarketSnapshot {
  configured: boolean;
  generatedAt?: string;
  methodology?: { version: string; weights: Record<string, number>; doc: string };
  freshness?: { lastSuccessfulRunAt: string | null; lastRunStatus: string | null; stale: boolean; staleAfterHours: number };
  sources?: SourceStatus[];
  runs?: RunInfo[];
  skills?: SkillData[];
  vacancies?: { dataset: string; source: string; series: { key: string; geo: string; label: string; unit: string; points: { period: string; value: number }[] }[] };
  wef?: { source: string; url: string; period: string };
}

export interface Fact {
  text: string;
  source: string;
  period: string | null;
}

export interface RecommendationItem {
  skill_id: string;
  label_bg: string;
  label_en: string;
  esco_uri: string | null;
  model: { horizon_score: number; future_skills_score: number | null; confidence: Confidence; coverage: number; methodology: string | null; computed_date: string | null };
  relevance: { type: 'favorites' | 'quiz' | 'complements'; careers?: string[]; label?: string; skills?: string[] }[];
  facts: Fact[];
  forecasts: Fact[];
  next_skills: { id: string; label_bg: string }[];
  learning: { label: string; url: string }[];
  limitations: string[];
}

export interface Horizon {
  label: string;
  available: boolean;
  reason: string | null;
  items: RecommendationItem[];
}

export interface RecommendationsResponse {
  configured: boolean;
  ready?: boolean;
  computedDate?: string;
  horizons?: Record<'short' | 'medium' | 'long', Horizon> | null;
  ai?: { available: boolean; reason?: string; model?: string; explanations?: Record<string, string>; rejected?: number } | null;
}

export interface RecommendationProfile {
  knownSkills: string[];
  favoriteCareerIds: string[];
  quizCategory: string | null;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchMarketData(): Promise<MarketSnapshot> {
  return asJson<MarketSnapshot>(await fetch('/api/market-data'));
}

export async function fetchRecommendations(profile: RecommendationProfile, explain = false): Promise<RecommendationsResponse> {
  return asJson<RecommendationsResponse>(
    await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...profile, explain }),
    }),
  );
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchIsAdmin(): Promise<boolean> {
  const headers = await authHeader();
  if (!headers.authorization) return false;
  try {
    const r = await asJson<{ isAdmin: boolean }>(await fetch('/api/admin/refresh', { headers }));
    return r.isAdmin;
  } catch {
    return false;
  }
}

export async function runAdminRefresh(): Promise<{ status: string; reason?: string }> {
  return asJson(await fetch('/api/admin/refresh', { method: 'POST', headers: await authHeader() }));
}

export const QUIZ_CATEGORY_KEY = 'future_jobs_quiz_category';

export function readQuizCategory(): string | null {
  try {
    return localStorage.getItem(QUIZ_CATEGORY_KEY);
  } catch {
    return null;
  }
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('bg-BG', { dateStyle: 'medium' }) : '—';

export const fmtPct = (x: number, digits = 1) => `${(x * 100).toFixed(digits).replace('.', ',')}%`;

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'висока',
  medium: 'средна',
  low: 'ниска',
  insufficient: 'недостатъчно данни',
};
