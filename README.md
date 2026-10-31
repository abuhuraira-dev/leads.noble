# Google Maps update

Start with [GOOGLE-MAPS-START.md](GOOGLE-MAPS-START.md). This version adds Google Maps discovery with rating/review filters, background jobs, original listing details, duplicate prevention and scraper CSV import. The original documentation below describes the legacy OpenStreetMap workflow. Google Maps requires the separate Docker engine.

# NobleLeads — Noblesoft

A private, responsive agency workspace for discovering businesses, verifying opportunities, writing offers, tracking conversations and producing branded invoices. This is an installable web app (PWA), not a Play Store / App Store binary.

## Open the app

Hosted on Vercel with data in Supabase; sign in with your admin username and password (same on phone). See [DEPLOY.md](DEPLOY.md). Your noblesoft.site marketing site is independent.

## What works

- OpenStreetMap / Overpass discovery by industry and city + country; optional coordinates and radius. No paid Google Maps or AI API is required.
- Duplicate detection, persistent run history, one-at-a-time research with pause/resume and visible failures.
- Bounded public website research with robots handling, DNS checks, public email and phone extraction, contact-page lookup, HTML signals and source evidence.
- Explicit manual confirmation of the industry, location, contact and actual need. An unlisted website stays unknown. HTML omissions never automatically become a sales claim.
- Editable personalized offers, reviewed copy / mailto handoff, durable pipeline stages, follow-up dates and permanent Do not contact suppression.
- Original Noblesoft Invoice Studio with linked clients and D1 save/reopen; original email playbook. Print-to-PDF and editable invoice JSON remain available.
- CSV/JSON lead imports, CSV export and full JSON backup; restore adds missing businesses for re-verification and independent invoice copies.
- Responsive desktop / mobile layout, home-screen installation and a clear offline message. Business records require internet.

## Run locally

See DEPLOY.md. `npm install`, fill `.env.local`, `npm run dev`. Tests: `npm test`. Types: `npm run typecheck`.

## Operational boundaries

The guided discovery/research workflow runs while the tab remains open. It is not a daily cron job or an unattended email sender. No messages are sent by this app: clicking Open email app creates a draft in your email software. Mark Contacted after you send. Reply and opt-out status must be recorded manually; inboxes are not connected.

Overpass is a shared public service, not guaranteed lead inventory or an SLA. This app uses the Private.coffee and VK Maps public Overpass instances, which list permission for use in commercial projects. It does not use the main overpass-api.de service. This app limits searches to 40 returned businesses, radius to 15 km, and search cadence to one per minute. City matching uses OSM administrative names; coordinates work when boundaries are missing. Discovery does not use Nominatim or paid Places. See https://wiki.openstreetmap.org/wiki/Overpass_API and https://www.openstreetmap.org/copyright. Retain OSM attribution and observe ODbL obligations when redistributing data.

Website research inspects HTML, not a rendered browser or a full technical audit. It can miss JavaScript features and cannot verify email deliverability, budgets or buying intent. Current opportunity and contact verification are human decisions. Public records can be stale. No no-website, revenue, rating or ranking claims are invented.

No paid ads or API subscription is required by this implementation. Hosting and third-party service quotas still depend on the provider and your account; this repository does not promise unlimited free hosting.

## Source and privacy

Your ZIP was treated as reference material. Its .env, database, credentials, workflow tokens and historical runtime data are not copied into this app. The two supplied HTML tools retain their branding and content; the invoice tool adds a same-origin bridge to save and restore records. New source lives in app/, lib/, db/, tests/, public/. No runtime secrets are required for the current feature set. Keep future secrets in server runtime configuration, never in browser code.

