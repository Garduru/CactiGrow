# Official website and game deployment preparation

Prepared from `68c33d7095f15a5e5a3b71abab15fb7ab36d1dc7`. No remote changes,
deployment, commit or domain cutover are authorized by this preparation.

## Application

`/` is the public CactiGrow homepage, reusing the official logo, palette and approved
Nursery artwork. PLAY NOW navigates within the same React application to `/play`,
which mounts the existing Phaser Farm. There is no second game or game-state copy.
All game routes share one `GameSession` provider tree and the unchanged authenticated
deployment boundary. The homepage does not mount bootstrap/game providers or open
a realtime connection. Leaving the game for the website ends the game session;
server-owned progress reloads normally on re-entry (development-only local prototype
state is transient). No new sign-in provider or login UI has been invented.

Farm return links, the HUD logo, and Town's Road to Farm now use `/play`, preserving
the authored exterior/road spawn state. `/farm` and `/world-preview` redirect there.
`/town`, `/home`, `/nursery`, `/garden`, `/inventory`, `/lab`, `/mail`, `/shop`, `/market`,
`/breeding`, `/skills`, `/journal`, `/research` and `/achievements` remain unchanged.
`/collection` and `/marketplace` keep their aliases; `/friends` and `/chat` return to
Farm. Alias redirects retain search, hash and navigation state. Old Farm return
history referring to `/` safely resolves to `/play`. Development tools now open at
`/play?plantTest` or `/play?worldEdit`; PLAY NOW retains explicit query options.

Staging/production HTTP calls use relative `/api/*`, ignoring the development API
base-URL override. Production ignores Account A/B query/header shortcuts and still
fails closed. Wrangler serves assets and the SPA fallback, with `/api/*` dispatched
to the Worker first. Refreshing/deep-linking to `/play` or `/town` loads the same app.

## Current hosting evidence (2026-09-27)

- Public DNS: authoritative nameservers are `clarissa.ns.cloudflare.com` and
  `margo.ns.cloudflare.com`. Apex A answers are Cloudflare proxy addresses
  `104.21.55.65` and `172.67.170.154`; these do **not** identify the origin host.
- Anonymous HTTPS checks: apex and `www` return 403 through Cloudflare;
  `dev.cactigrow.com` returns 302 to the configured Cloudflare Access login.
- Repository/runbook: the old apex A and `www` Base44 CNAME were imported during
  the earlier nameserver move. Their **current dashboard values and origin target
  have not been verified**. Public DNS cannot expose flattened/proxied origin values.
  Export/review the live zone before editing; do not infer that all old records remain.
- The checked-in private staging target is Worker `cactigrow-staging`, Custom Domain
  `dev.cactigrow.com`, with its separate staging Hyperdrive and verified Access JWT
  configuration. It is unchanged here.
- The production target is `cactigrow-api-production`. Its prepared configuration
  explicitly has no routes, no Hyperdrive, no workers.dev/preview exposure, and
  realtime disabled. No production deployment or resource inventory is claimed.

## Required steps before a playable production launch

1. **Approve and implement production authentication.** The actual
   `server/auth/authentication.ts` returns no provider in production. The public
   homepage is ready, but `/play` will show the access boundary until this is resolved.
   Agree the production provider/session/login/logout flow, verify identity mapping
   and session expiry, and preserve the staging-only Access policy. Do not relabel
   production as staging or enable development identities. If using Access for an
   initial private launch, define its production application and path policy so the
   public homepage is accessible while APIs and game entry remain protected.
2. **Approve separate production persistence and onboarding.** Provision an isolated
   production database, runtime role and cache-disabled production Hyperdrive; apply
   the existing reviewed schema and grants only after explicit approval. Bind only
   that production Hyperdrive ID under `env.production.hyperdrive`. Do not use
   `cactigrow_staging`, its credentials or its binding ID. Existing automatic starter
   initialization is staging-only; a production onboarding policy must be approved
   and verified, not silently inherited. No new economy behavior is part of this work.
3. **Verify before exposure.** Run tests, `npm run build:production`,
   `npm run worker:types:check` and `npm run dry-run:production`. Confirm the bundle is
   production-mode, the binding points only at production, development headers are
   rejected, and two authorized accounts have isolated persistent game state.
   Verify the static headers/CSP and authentication behavior on real browsers.
4. **Inventory and approve the exact domain replacement.** Export Cloudflare zone
   records and inspect Workers Custom Domains/routes, redirects, Access/WAF rules,
   and any existing Pages/other-host attachment for `cactigrow.com` and `www`.
   Record the old origin values/proxy settings for rollback. Identify each conflicting
   apex website record before removal/replacement; preserve MX/TXT/email/verification,
   `dev`, and all unrelated CactiSwap records and applications.
5. **Only after explicit final cutover approval:** change the production `routes`
   array to `[{ "pattern": "cactigrow.com", "custom_domain": true }]`. Use the
   existing guarded production wrapper (`CACTIGROW_DEPLOY_CONFIRM=production`,
   then `npm run deploy:production`) with the reviewed build. Cloudflare Custom
   Domains manage the necessary DNS/certificate; do not point an apex A record at
   a Workers IP. Review and approve any conflicting record replacement separately.
   See [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
6. **Handle `www` explicitly.** After verifying its current purpose, approve a
   Cloudflare redirect from `https://www.cactigrow.com/*` to
   `https://cactigrow.com/<same path and query>`, with appropriate proxied DNS and TLS.
   It is not configured or changed by this patch. Do not attach `www` to the game
   without deciding canonical-origin behavior for authenticated multiplayer.
7. Check homepage, PLAY NOW, login/logout/expiry, refresh/deep links, mobile controls,
   same-origin API errors and persistent account isolation. Keep `dev` protected.
   Record the new Worker version and prior origin/Worker version; rollback restores
   the recorded website/domain attachment, never deletes or reverses player data.

These are launch blockers, not claims that a configuration flag alone makes the
current build production-playable. No final cutover should be approved until the
identity, persistence, onboarding and browser acceptance items are satisfied.

## Multiplayer production requirements

L1/L2/L3 and the Town client remain intact. The prepared production vars use
`CACTIGROW_REALTIME_ORIGIN=https://cactigrow.com` and
`CACTIGROW_REALTIME_ENABLED=false`; no production DO is provisioned or bound.
The client derives its endpoint from `window.location.origin` and the validated L3
socket path: admission `/api/v1/realtime/admission`, upgrade
`wss://cactigrow.com/api/v1/realtime/areas/town` after future approval.

Production is still blocked independently in `useTownPresence.ts` and
`server/realtime/admissionRoutes.ts`, even if an enable flag is set. A separately
approved enablement must verify real production identity/session expiry, bind
`AREA_PRESENCE` to the existing SQLite `AreaPresence` class/export, verify persistence
and hibernation recovery, and deliberately replace those hard gates with reviewed
production enablement. Keep tickets and Layer selection server-owned. Verify the
edge forwards WebSocket subprotocols and session/origin checks, and test explicit
same-origin `wss://cactigrow.com` CSP support where `'self'` is insufficient. No wildcard
WebSocket origin should be added. Complete two-account reconnect/expiry/slow-reader
and sustained-load checks before setting the production enable flag.

## Local validation

`npm run dev` previews the homepage and existing local prototype at `/play`.
For a production-shaped local check, build production assets and run
`npx wrangler dev --local --env production --config wrangler.jsonc --port 8792`.
The homepage loads; game bootstrap correctly returns 401 and realtime returns 404.
This configuration has no database binding and is not a live-account playtest.
The existing two-account multiplayer procedure remains in
[`MULTIPLAYER_TOWN_PLAYABLE_MILESTONE.md`](MULTIPLAYER_TOWN_PLAYABLE_MILESTONE.md).

`npm run test:website` tests the actual public/game route boundary using React
server rendering (Phaser stubbed) and Farm/Town return-state compatibility. Existing
Worker/client/realtime/E1/Garden suites cover unchanged authentication and gameplay.
Local Worker HTTP checks verify SPA deep links and JSON API rejection, not production
credentials, remote deployment, live database acceptance or mobile hardware.

Preparation validation passed: 2 website tests, 32 Worker, 22 API client, 8 multiplayer
client, 45 L1, 17 L2, 7 L3, 6 E1 and 10 Garden tests; TypeScript (including the new
test), ESLint, production build, Worker type freshness, production dry-run and diff
whitespace checks. The dry-run reported only assets and production vars, no database
or DO binding. Browser checks in Zen verified desktop homepage, PLAY NOW to Farm,
Farm Travel to Town and Town refresh, plus 320x480 homepage/Town presentation and
mobile PLAY NOW to the production access gate. No authenticated production gameplay
or physical-phone acceptance is claimed. Restart local Wrangler after rebuilding
`dist` if Windows reports an asset watcher EPERM error; stale local asset manifests
are not deployment evidence. The existing large Phaser chunk build warning remains.
