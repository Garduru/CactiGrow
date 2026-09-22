# Deployment-safe staging foundation

## Topology and environments

CactiGrow uses one Cloudflare Worker per environment. The Worker serves the Vite `dist/` output and handles same-origin `/api/*` before the SPA fallback. BrowserRouter deep links therefore resolve to `index.html`, while unknown API routes remain structured API 404 responses. The browser continues to call relative `/api/*`; local Vite proxies those requests to the development Worker.

The unqualified Wrangler target is deliberately named `cactigrow-deploy-disabled`, has no Hyperdrive binding, and has `workers_dev = false`. Never deploy it. The explicit `development` environment retains its development Hyperdrive resource. The `staging` environment binds only the isolated `cactigrow-staging` Hyperdrive resource (database `cactigrow_staging`, runtime role `cactigrow_staging_runtime`, direct Neon origin, TLS required, caching disabled). `production` has no active database binding. Wrangler environment bindings are not inherited.

Development permits the explicit Account A/B identity header, optional `?e1Lifecycle=server`, accelerated two-minute growth, and build-gated visual tools. Staging is server-authoritative and requires a cryptographically verified Cloudflare Access application JWT through the identity adapter. Verification checks the RS256 signature against the team's Access JWKS, issuer, application audience, token type, expiry, and identity claims; missing/invalid configuration fails closed. The Access application must protect the entire `dev.cactigrow.com` hostname. The same two-minute prototype growth rule is deliberately enabled for this isolated staging playtest and remains forbidden in production. Production has no identity or database configuration yet.

## Build and deployment procedure

- Development preview: `npm run dev` and `npm run dev:worker`.
- Staging-shaped build: `npm run build:staging`.
- Production-shaped build: `npm run build:production`.
- Configuration-only checks: `npm run dry-run:development`, `npm run dry-run:staging`, and `npm run dry-run:production` after building.
- Staging deployment: complete every prerequisite below, then set `CACTIGROW_DEPLOY_CONFIRM=staging` for that shell and run `npm run deploy:staging`.
- Production deployment: complete a separate production review, set `CACTIGROW_DEPLOY_CONFIRM=production`, and run `npm run deploy:production`.

The deployment wrapper refuses an absent, ambiguous, or mismatched confirmation. Do not use unqualified `wrangler deploy`. Before an environment deployment, apply reviewed additive migrations with the owner/migration role, verify the target database name and direct/unpooled connection, then apply and verify the least-privilege runtime grants. Application rollback never destructively reverses a database migration.

## Required staging infrastructure

Before remote staging is exposed, provision and review: a separate staging Neon database and roles; the staging Hyperdrive binding; a protected hostname/custom domain; a Cloudflare Access application with an exact-email Allow policy; its audience and issuer/team-domain Worker configuration; and rate limiting. On the Free plan the one available zone rate rule should cover only the `/api/*` path, count by IP, and exclude static assets by path. Preserve command idempotency and optimistic versions. Do not add a PostgreSQL distributed rate limiter.

The first staging deployment was uploaded on 2026-09-21 as Worker version `464d8adc-cb72-40b6-a586-f4b62ec1dedb`, attached to the `dev.cactigrow.com` Custom Domain. The user confirmed the Cloudflare zone is Active, the full-host Access application uses an exact tester-email Allow policy, and the `/api/` rule is deployed at 100 requests per 10 seconds per IP with a 10-second Block action. Anonymous `/`, `/api/health`, and `/api/v1/me/bootstrap` requests all redirected to the Access team domain after deployment. Authenticated gameplay and cross-device persistence remain to be verified; this is not yet a complete playtest checkpoint.

Staging seed provisioning is an explicit owner-side operation after the approved tester has authenticated once. Set `CACTIGROW_ENABLE_STAGING_PROVISIONING=1` and `CACTIGROW_ENVIRONMENT=staging`, supply a direct owner `DATABASE_URL` for exactly `cactigrow_staging`, and run `npm run db:provision:staging-seeds`. The script requires exactly one durable Cloudflare Access player, inserts only missing stacks of four San Pedro and two Peyote seeds, creates the lifecycle version row if absent, and never refills existing stacks. The six Nursery slots are empty when no occupancy rows exist. This is never a bootstrap side effect or client-triggerable endpoint; do not persist or print the owner URL.

Multi-tester onboarding is being prepared but is **not yet deployed**. The existing owner-only fixture above is a historical manual tool, not an authentication rule. A verified Access application JWT yields the user's `sub`, and the provider-neutral identity resolver maps that subject to a durable internal player UUID. This path cannot substitute for the Access Allow policy and never activates under production configuration.

Grower Alpha initialization migration `0003_powerful_terrax.sql` and its narrow runtime grants were applied to protected staging on 2026-09-22. Worker version `bd8cefdc-a9cc-40e9-879f-1597b95571c2` is deployed; authenticated human verification of the fresh-tester projection remains pending. It replaces opportunistic missing-row seed insertion with a durable `player_onboarding` row. The first verified staging request serializes on that player's unique row and atomically grants the `grower-alpha-v1` starter package only if no plant-lifecycle footprint exists. Existing players are marked initialized with `starter_granted_at = NULL` and retain every stack, specimen, seed, and lineage row unchanged; even zero-quantity stacks prevent a second grant. The new additive table carries the profile ID, initialization/grant timestamps, future tutorial markers, 0 Cultivation XP, and 0 Alpha Tokens. The Shop has no stocked offers or seed prices, so 0 is the deliberate non-spendable start rather than a fabricated economy grant. `GET /api/v2/me/bootstrap` exposes only the server Grower snapshot in staging; Phase D V1 bootstrap stays unchanged. Production remains without an identity/economy backend and fails closed. Before staging deployment, apply migration `0003_powerful_terrax.sql` with the staging owner on the direct connection and verify the runtime role has `SELECT`, `INSERT`, `UPDATE` on `player_onboarding` and `INSERT` on `player_seed_stacks` in addition to existing grants. Do not deploy a Worker that queries the new table before its migration and grants are verified.

The consolidated Grower Alpha migration is `0004_massive_angel.sql`. It is additive except for widening the existing specimen lifecycle check to admit the established terminal `sold` state. It backfills lifecycle-derived Cultivation/Breeding XP, discoveries, Shiny journal identity, event history, and achievements without changing inventory, specimens, genetics, lineage, Nursery occupancy, or bred-seed ownership. Before its staging Worker is deployed, apply it with the direct/unpooled staging owner connection and grant `cactigrow_staging_runtime` only the additional access below (existing narrower grants remain):

- `player_onboarding`: existing `SELECT`, `INSERT`, `UPDATE` remain sufficient.
- `player_grower_state`: `SELECT`, `INSERT`, `UPDATE`.
- `player_grower_events`: `SELECT`, `INSERT`.
- `player_garden_specimens`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
- `player_garden_displays`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
- `marketplace_listings`: `SELECT`, `INSERT`, `UPDATE`.
- `bred_seed_treatments`: `SELECT`, `INSERT`, `UPDATE`.
- Existing lifecycle tables retain their E1/E2 grants; no migration-table access, schema `CREATE`, database `CREATE`, role membership, or elevated role attribute is added.

The staging client uses additive Plant Lifecycle V3. V1/V2 remain unchanged. V3 projects all eight authored Nursery positions plus an authoritative capacity of six or eight; positions seven and eight reject writes until the persisted Expanded Benches upgrade is owned.

Migration `0004_massive_angel.sql` and the reviewed grants were applied to protected staging on 2026-09-22. Pre/post fingerprints matched for all existing identity and plant-lifecycle tables (2 players, 2 identities, 2 seed-stack rows, 25 clone lines/profiles, 19 specimens, 6 Nursery occupancies, and 19 bred seeds). Worker version `9090f547-e614-4951-b783-9771e80bbfb6` is deployed for human Grower Alpha verification; the immediately previous version is `bd8cefdc-a9cc-40e9-879f-1597b95571c2`. Anonymous checks confirm both the SPA and V3 lifecycle route remain behind Cloudflare Access. Production, apex, `www`, DNS, Access policy, and Hyperdrive configuration were not changed.

The current static header policy blocks framing, MIME sniffing, unnecessary browser capabilities, cross-origin API connections, plugins, and unexpected base/form targets. Inline styles remain allowed because the existing React UI uses style attributes; tighten this only after browser inspection. HSTS is intentionally deferred until the domain cutover and rollback plan are approved. Versioned assets under `/assets/*` are immutable for one year; the SPA shell revalidates. Any future unversioned file placed under `/assets/` must move outside that rule or gain a versioned name.

## Rollback

The Phase E2 breeding build deployed on 2026-09-22 as staging Worker version `93434e96-a623-497d-b3c0-980cae25eb60`. The immediately previous healthy deployed version is `0375ab6a-659c-4c17-aa20-984fe2c7d04b`. Migration `0002_smooth_lady_vermin.sql` is additive and remains in place during an application rollback. Existing staging specimen and commodity stack counts were preserved; authenticated E2 gameplay review is pending.

Record the deployed Worker version ID and the immediately previous healthy version after every deployment. For an application rollback, use Cloudflare version/deployment history to restore the previous Worker and static-asset version, verify `/api/health`, authenticated bootstrap, and one read projection, then inspect errors before resuming writes. Do not reverse database migrations during ordinary rollback; deploy code compatible with additive schema changes or issue a separately reviewed forward repair.

## DNS and apex cutover status

The user explicitly authorized replacing the old CactiGrow/Base44 website records. Hostinger's source zone contained only the apex A and `www` Base44 CNAME; there were no email or ownership-verification records to preserve, and DNSSEC was disabled. `cactigrow.com` was added to Cloudflare on the Free full-zone setup, and the user switched authoritative nameservers to the assigned Cloudflare pair. The imported old website records may remain temporarily; they do not define the private development target. `dev.cactigrow.com` is the staging hostname, while a future, separately authorized production cutover may use the apex. No production Worker or database is provisioned by this staging work.

After provisioning, test staging from independent desktop and phone browser contexts: Access authentication, stable bootstrap identity, account isolation, server-authoritative plant lifecycle, SPA deep links, API 404s, headers, cache behavior, logout/expired sessions, rate limits, and rollback.
