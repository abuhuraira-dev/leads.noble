# LeadsNoble: Google Maps discovery

This is the attached LeadsNoble v5 with Google Maps discovery added. Your other app and older repaired checkout are unchanged.

## Start on Windows

1. Open Docker Desktop and wait until its engine is running.
2. Open PowerShell in this folder and run `./scripts/start-scraper.ps1`.
3. Copy `.env.example` to `.env.local` and fill your existing Supabase URL, service key, admin password and session secret. Keep `SCRAPER_BASE_URL=http://127.0.0.1:8080` for local use. If the database has not been set up, run `supabase/schema.sql` in your Supabase SQL editor first.
4. Run `npm ci`, then `npm run dev`. Open the localhost URL printed in the terminal and sign in.
5. Open Discover, choose Google Maps, then Check scraper connection. Choose a specific city, industry, minimum rating and minimum reviews. Defaults: 4 stars, 10 reviews, no website listed, 15 businesses.
6. Press Search Google Maps. The engine collects listings in the background. The app checks progress every eight seconds and imports five matching leads per request. Searches often take several minutes.
7. Open Leads → Maps opportunities to see businesses with at least 4 stars, 10 reviews and no website listed. Your campaign can use different thresholds; All shows every saved lead. Open a lead to see ratings, contact details, source links and all collected fields. Verify the business and website absence, qualify the lead, then use the existing offer and pipeline workflow.

If this computer already has dependencies installed for this project, skip `npm ci`. The development workspace uses a local dependency junction for testing; that junction is excluded from the release ZIP.

## How it works

The pinned `gosom/google-maps-scraper:v1.18.1` container provides the browser engine used by your attached scraper kit. LeadsNoble calls its create-job, status and download endpoints directly. No AI agent, Python process or manual sheet transfer is needed. Google Maps jobs do not use the Geoapify key or Overpass servers.

The importer maps title/address/emails to the existing lead fields, keeps Google place IDs for deduplication, and stores the complete original CSV row in the lead's Maps details. Ratings and review counts are available in lead CSV exports; full JSON backups include all Maps fields. Existing leads are never replaced during discovery, so notes, offers and suppression remain intact.

The no-website filter uses the original Maps website field. A social page in that field is excluded from strict no-website results. A blank field is evidence of “no website listed,” not proof that no website exists. Missing phone/email does not discard an otherwise promising listing. Qualification still requires you to verify contact and opportunity.

Closing the app does not stop the scraper container. Importing resumes when you reopen the app. A transient poll error leaves the run available for Check progress. To retry a failed search, submit a new campaign after the one-minute cooldown. Stop job asks the engine to delete the job and retains already saved leads. If the engine is offline, restart Docker first.

## Diagnose failures

| Message | Meaning / action |
| --- | --- |
| Engine unreachable | Docker/container stopped or wrong server address. Run the startup script. |
| HTTP 401/403 from engine | Authentication on your proxy rejected the request; check server-only `SCRAPER_API_KEY`. |
| HTTP 429 | Engine/proxy rate limit; wait. |
| Engine reported failed | Inspect `docker compose logs --tail 100`; engine/browser failure or Google blocking is possible, not confirmed by that message alone. |
| Collected listings but no matches | Listings did not meet the rating/review/website filters. Lower thresholds or try another city. |
| No collected listings | Check engine logs and job UI at `http://localhost:8080`; an empty file alone cannot distinguish no matches from Google blocking. |
| Database error | Check Supabase configuration and schema. The job may still be available to resume. |

The radius guides the engine's map search and is not a strict geographic boundary. Review each lead's address. Broad state/province selections do not guarantee full regional coverage. This first version runs one city search at a time; grid searches, social enrichment and Google Maps daily scheduling are not enabled. The existing daily automation remains explicitly labeled OpenStreetMap.

## Hosting

The browser engine needs a persistent Docker-capable computer/server. A Vercel Next.js deployment cannot run this container internally, and `localhost` on Vercel does not refer to your PC. Host the engine on a reachable server and set the app's server-only `SCRAPER_BASE_URL`. The engine has no built-in authentication: leave the local port bound to 127.0.0.1. For remote access, use an authenticated HTTPS reverse proxy and configure `SCRAPER_API_KEY`; do not expose the engine directly.

## Validation

- `npm test` covers the existing workflow plus Maps filtering, mapping, stable IDs, resumable import, duplicate handling and explicit failures.
- `npm run build` validates the Next.js production build.
- `node scripts/google-integration.mjs --browser` tests authenticated API creation, polling, persistence, CSV import and repeat polling against isolated fixture services, then checks desktop/mobile UI. It requires Playwright, supplied in this development workspace. Fixture tests do not establish Google availability.

See `IMPLEMENTATION-REPORT.md` for the live test result and any remaining environment limitations.
