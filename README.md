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
