# PlayHub / LeeHub backend — Cloudflare migration readiness

## Current confirmed architecture
- Node.js Express with Supabase, CORS, admin authorization, video paywall/monetization endpoints, and the `fluent-ffmpeg` dependency.
- Current Render `playhub-backend1` is billing-suspended. Several legacy PlayHub services in the same workspace use the `playhub-backend` repository, which is not currently available from the connected GitHub account.
- Cloudflare Pages only serves static site code; **it cannot host this Express + FFmpeg service as-is**. Worker compatibility for FFmpeg, streams, and authenticated billing has not been established.
- Never expose Supabase service keys, payment credentials or admin passwords in Pages build variables or client bundles.

## Parallel migration gates
1. Keep the original Render app and all records. Do not delete/rename services or change existing domains.
2. Inventory actual dependencies for each of the legacy PlayHub service IDs and resolve the missing `playhub-backend` repository before attempting their cutover.
3. Create a separate runtime with an explicit, verified free allowance that supports Node.js processes, FFmpeg if required, CORS, webhooks and persistent storage.
4. Configure allowlisted preview frontend origins **in addition to** current allowed origins; never use `origin: '*'` for authenticated production APIs.
5. Test read endpoints, access denied, admin auth, monetization verification, duplicate transaction reconciliation, streaming and CORS. No real transactions in staging.
6. Check logs, capacity and rate limits, then separately approve and schedule DNS/URL cutover; retain old endpoints for rollback.

## BLOCKED
No verified new backend host or Cloudflare account connection; code and production infrastructure remain unchanged. This document creates no billable resources.
