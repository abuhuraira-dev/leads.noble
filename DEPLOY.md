# Deploy LeadsNoble on Supabase + Vercel

1. **Supabase** (free): create a project -> SQL Editor -> paste `supabase/schema.sql` -> Run.
   Then Project Settings -> API: copy the Project URL and the service-role (secret) key.
2. **Secrets** (PowerShell):
   `$b=New-Object byte[] 48;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b) -replace '[+/=]',''`
   Run it twice: one value for ADMIN_PASSWORD, another for SESSION_SECRET.
3. **GitHub**: private repo, push this folder (`.env*` and `node_modules` are git-ignored).
4. **Vercel**: Add New -> Project -> import the repo (Next.js is auto-detected). Add the variables from `.env.example`. Deploy.
5. **Daily run**: also add `CRON_SECRET` (any random 16+ characters). `vercel.json` already schedules `/api/cron` at 04:00 UTC (09:00 Karachi).
   In the app: Settings -> Daily run -> add targets (one per line, e.g. `Dentists | Karachi | PK`) -> tick "Run every morning" -> Save.
   Automatic mode (default) rotates through the priority markets with no setup: one country, one industry and two regions per day, reshuffled every other day, never repeating a combination until all have been used, at most 40 new leads a day, and no duplicate leads.
   Optional Telegram alerts: add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
6. **Check**: open `https://YOUR-APP.vercel.app/api/health` -> `{"database":"ready"}`. Sign in. Then open
   `/api/health?check=discovery` (while signed in) to test live OpenStreetMap discovery.
7. **Phone**: open the URL -> Android: menu -> Install app / iPhone: Share -> Add to Home Screen.

Local run: copy `.env.example` to `.env.local`, fill it, `npm install`, `npm run dev`.
Tests: `npm test` (27) and `npm run typecheck`.

## Troubleshooting
- **Vercel shows `404: NOT_FOUND`**: Vercel is not building the Next.js app. In the project: Settings -> General -> *Root Directory* must be the folder that contains `package.json` and `app/` (if your repo has a `leads-noble` or `noble-leads` folder inside it, set that folder, or move its contents to the repo root). Settings -> Build and Deployment -> *Framework Preset* must be **Next.js** and *Output Directory* must be empty. Then Deployments -> Redeploy. `vercel.json` already sets the framework.
- **Discovery says HTTP 504 / timed out**: the free public OpenStreetMap servers are busy. The app now tries two servers, twice. City searches use a small radius around the city centre (fast); states and provinces use a boundary lookup (slower). Try again in a few minutes, use coordinates with a 2-5 km radius, or import a CSV. `/api/health?check=discovery` (signed in) tests the connection.
- **Red "1 Issue" badge in `npm run dev`**: Next.js's development overlay. It does not appear in the deployed app.
