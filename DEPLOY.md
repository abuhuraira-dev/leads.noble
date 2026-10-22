# Deploy NobleLeads on Supabase + Vercel

1. **Supabase** (free): create a project -> SQL Editor -> paste `supabase/schema.sql` -> Run.
   Then Project Settings -> API: copy the Project URL and the service-role (secret) key.
2. **Secrets** (PowerShell):
   `$b=New-Object byte[] 48;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b) -replace '[+/=]',''`
   Run it twice: one value for ADMIN_PASSWORD, another for SESSION_SECRET.
3. **GitHub**: private repo, push this folder (`.env*` and `node_modules` are git-ignored).
4. **Vercel**: Add New -> Project -> import the repo (Next.js is auto-detected). Add the variables from `.env.example`. Deploy.
5. **Daily run**: also add `CRON_SECRET` (any random 16+ characters). `vercel.json` already schedules `/api/cron` at 04:00 UTC (09:00 Karachi).
   In the app: Settings -> Daily run -> add targets (one per line, e.g. `Dentists | Karachi | PK`) -> tick "Run every morning" -> Save.
   Optional Telegram alerts: add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
6. **Check**: open `https://YOUR-APP.vercel.app/api/health` -> `{"database":"ready"}`. Sign in. Then open
   `/api/health?check=discovery` (while signed in) to test live OpenStreetMap discovery.
7. **Phone**: open the URL -> Android: menu -> Install app / iPhone: Share -> Add to Home Screen.

Local run: copy `.env.example` to `.env.local`, fill it, `npm install`, `npm run dev`.
Tests: `npm test` (21) and `npm run typecheck`.
