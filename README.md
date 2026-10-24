# Future-Jobs (React + TypeScript + Vite)

## Run locally
```bash
npm install
cp .env.example .env.local      # then fill in your Supabase URL + anon/publishable key
npm run dev
```

## Database
Run `supabase/schema.sql` in the Supabase SQL Editor, and enable Email (and optionally Anonymous) sign-ins under Authentication.

## Deploy to Vercel
1. Push the project to GitHub.
2. In Vercel: **Add New → Project**, import the repo. The Vite preset is detected automatically
   (build command `npm run build`, output directory `dist`).
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   under **Settings → Environment Variables**, then deploy.
4. In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel domain.

Without the env vars the app still runs; favorites are then saved in localStorage only.

## Live labour-market data (daily refresh)
FUTURE-JOBS collects real data every day at 06:00 Europe/Sofia and uses it for the skills table, the
Eurostat chart and the personalised skill plan. Details: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md),
scoring model: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

1. Supabase → SQL Editor: run `supabase/migrations/20261023000000_market_data.sql` (additive, safe to re-run).
2. Vercel → Settings → Environment Variables (Production):
   - `SUPABASE_URL` — same value as `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API (server only, never `VITE_`)
   - `CRON_SECRET` — random string, at least 16 characters
   - `ADMIN_EMAILS` — comma-separated e-mails allowed to press "Обнови сега" (optional)
   - `GEMINI_API_KEY` is reused for the optional AI explanations
3. Redeploy. The cron jobs in `vercel.json` appear under Settings → Cron Jobs.
4. Trigger the first import instead of waiting for 06:00:
   `curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-domain>/api/cron/daily-refresh?force=1"`
5. Optional, for the 5–10 year horizon: import Cedefop forecasts (`npm run import:cedefop`, see docs).

```bash
npm test            # unit + pipeline tests (no network)
npm run typecheck
```
`.github/workflows/data-integration.yml` runs the pipeline against the real sources and a throw-away local Supabase.
