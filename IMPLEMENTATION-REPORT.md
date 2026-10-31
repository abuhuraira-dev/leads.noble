# Google Maps implementation report

Date: 22 October 2026 (Asia/Karachi)

## Delivered

- Based on the user-attached LeadsNoble-v5.zip, isolated in this folder.
- Google Maps becomes the default discovery source. Legacy OpenStreetMap discovery remains selectable and its daily automation is explicitly labeled separately.
- Default shortlist: no website listed, at least 4 stars and 10 reviews. Thresholds are editable. Results are ordered by review count, then rating.
- Persistent engine jobs, visible progress, manual status checks, stop, resumable five-record import batches and stable Google IDs.
- Complete original listing rows retained, including any hours, coordinates, ratings, review details or other fields present in the engine output. Availability depends on the listing and engine; no fields are invented.
- Ratings/review counts in tables, detail panels and CSV export. Full raw fields in the detail panel and JSON backups. Maps metadata survives backup restore.
- Scraper CSV columns automatically mapped. Existing notes, offers and suppression are preserved during duplicate discovery.
- Missing website fields never automatically qualify a lead or claim verified website absence.
- Authenticated server-only engine access; local port bound to loopback. Shared database request budget bounds API operations.
- Pinned Docker Compose file, Windows startup script with bundled-Compose fallback and deployment instructions.

## Verification

39 automated tests pass. These include filter behavior, quoted CSV fields, source retention, malformed engine schema rejection, stable IDs, multi-batch imports, recovery after an interrupted run save, no-overwrite duplicate handling and engine errors. Next.js production build and authenticated API/browser integration were tested during development; final verification results are recorded in the delivery message.

The isolated integration test exercises create job → completed result download → filter → save → reload → CSV import → repeated poll. Desktop/mobile checks inspect discovery, lead details and overflow, with no browser JavaScript errors. These use clearly fictional fixtures and do not touch the production database.

## Live test limitation

Docker was initially stopped. It was started and reported server version 29.4.0. The standard docker compose command was unavailable, so Docker Desktop's bundled docker-compose.exe was used. The pinned image download began but layer extraction failed with a read-only filesystem error. The host C: drive also reached zero free bytes during this attempt. No real Google Maps job could be submitted. This is a local Docker/storage failure; it is not evidence of Google rate limiting or blocking.

Task-generated build files were removed to recover space, and an affected source file was restored and re-tested. Free sufficient disk space and ensure Docker storage is healthy before running scripts/start-scraper.ps1 again. The supplied code is implemented and fixture-tested; real lead retrieval and the user's database connection remain unverified in this new checkout.

## Deployment boundary

Use your existing Supabase/admin configuration in .env.local. No secrets were copied into this release and no production records were modified. Vercel cannot run the browser container; a hosted app needs a reachable protected scraper server. Keep the port private unless an authenticated HTTPS proxy is configured. Google Maps grid/batch campaigns, social enrichment and daily Maps scheduling are not included in this first integration.
