# Production deployment — 2026-09-30

## Deployed

- Worker: `cactigrow-api-production`
- Version: `24683d16-42db-4a3c-9439-7c4f68d7a097`
- Reachable URL: https://cactigrow-api-production.cascadiacultivated.workers.dev
- Intended canonical origin: https://cactigrow.com
- Base44 application: `69ff2d4a5df1772fd16bd931` (existing CactiSwap app; account identity only).
- Hyperdrive: `158393f7112548959359357702fe183f`, caching disabled, runtime role `cactigrow_runtime`.
- Database: `cactigrow` at `ep-wild-pond-arf5s9do.c-4.us-west-2.aws.neon.tech`. The user explicitly approved sharing this database with development for initial launch. Development writes therefore affect this same database. Staging's separate database/binding and Worker were not changed.
- SQLite `AreaPresence` Durable Object created by Wrangler's existing declarative exports reconciliation. No new SQL migration or replacement multiplayer runtime was introduced.

The existing migration command completed successfully. All five checked-in migration hashes (0000–0004) are present in the database journal; all 18 public tables exist. Narrow runtime grants were added for the existing breeding/onboarding/Grower/Garden/treatment tables, starter seed insertion and genetic-profile updates. No reset, drop, truncation or manual deletion occurred. Existing migrations may perform their defined data backfills. The migration owner credential was loaded only into short-lived child processes, never stored in repository files, Worker vars, build configuration or logs. It is not a runtime binding.

Production reuses the existing once-only starter initialization and V2 Grower bootstrap. Garden/Grower endpoints now accept authenticated production requests. New plantings use the existing species catalog growth times (San Pedro 24 hours, Peyote 72 hours), recorded as growth rule 2. Existing stored schedules are untouched; development/staging keep their two-minute test clock. No economy constants or Marketplace behavior were redesigned.

Realtime requires the exact canonical origin, HTTPS, a remotely verified Base44 identity, internal UUID mapping and one-use tickets. Base44 provides no documented expiry in `auth.me()`, so production grants a bounded 15-minute connection authorization after verification, not a claimed provider token lifetime. Every fresh admission rechecks Base44; upstream revocation is not pushed to an open socket. Existing reconnect fencing is preserved. The workers.dev origin deliberately cannot obtain realtime admission.

## Domain cutover still required

The Workers Custom Domains API returned **409 / 100117** for both hostnames: existing externally managed DNS records prevent attachment. Previously denied DNS-list requests were not retried.

User-confirmed rollback records (not a new DNS API export):

| Name | Type | Target | Proxy |
| --- | --- | --- | --- |
| `cactigrow.com` | A | `216.24.57.1` | Proxied |
| `www.cactigrow.com` | CNAME | `bae4.onrender.com` | Proxied |

Exact dashboard actions:

1. Open Cloudflare → **cactigrow.com → DNS → Records**. Verify/export the two records above. Remove only that apex A record and that `www` CNAME to resolve the reported conflicts. Preserve `dev`, email records and every unrelated record.
2. Open **Workers & Pages → cactigrow-api-production → Settings → Domains & Routes → Add → Custom Domain**. Add `cactigrow.com`, then `www.cactigrow.com`. Cloudflare manages their DNS and certificates. Do not edit `cactigrow-staging`.
3. The deployed Worker already redirects all `www` requests to HTTPS apex with status 308, preserving path/query. No extra redirect Worker is needed.
4. After attachment, record both Custom Domains in `env.production.routes` in `wrangler.jsonc` before the next deployment, so configuration matches the dashboard. Current routes remain empty because neither attachment succeeded.

Rollback removes only these new Custom Domain attachments and restores the two recorded website records. Never reverse migrations or erase player data for an application rollback.

## Evidence and remaining acceptance

One production build passed, including TypeScript. Focused auth, growth schedule and local Worker/DO admission tests passed (21); selected Worker authentication/bootstrap tests passed (13); the public/game route boundary test passed (1). These include mocked/local SDK and realtime tests, not real two-account production acceptance.

Deployed HTTP checks: homepage, `/play`, `/town`, `/nursery`, `/garden`, `/inventory` and the referenced JS bundle return 200; the bundle includes the configured Base44 app and PLAY NOW. Health reports production. Anonymous bootstrap, development credentials and an invalid Bearer token return 401. Realtime admission from the noncanonical workers.dev origin returns 403. CSP allows Base44 HTTPS and canonical WSS. Base44 login CORS preflight for the canonical origin returned 200. SPA shell delivery does not prove authenticated Phaser rendering.

The old apex/www endpoints still returned 403 after the rejected attachment attempts; staging returned 302 to its existing Cloudflare Access hostname. No CactiSwap resources or original Grow application were changed.

After domain attachment, a real existing Base44 account must verify login, stable internal UUID, starter initialization, Farm/Nursery/Garden and Town. Two real accounts are required to verify visible multiplayer and reconnect behavior. No authenticated production login, player initialization, rendered Farm/Town or real two-account connection is claimed in this checkpoint. The Base44 application itself was not modified. Any provider-side account/verification/Turnstile requirement must be addressed through its supported configuration before declaring public login accepted.
