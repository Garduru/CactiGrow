# Roles and Admin Tools V1

## Release status — 2026-10-03

Implementation and disposable PostgreSQL validation are complete. Live rollout is **pending** the explicitly intended staging/production OWNER UUIDs and a secure direct owner connection or owner-console execution. No live migration 0006, Admin grants, OWNER assignment or Admin Worker deployment has been performed. Never infer the OWNER from the previously used staging tester, character name, email or Neon identity.

Live deployment-list checks during this milestone confirmed the preceding versions still active at 100%: staging `cactigrow-staging`, `b65d3368-4764-45a4-a3ec-8d85fc1fa1b5`; production `cactigrow-api-production`, `d391700a-41c9-479c-93ab-f5e63c0c4a9c`. Neither contains this new Admin milestone. Verify again before releasing.

## Architecture and authorization

Neon Auth and the existing authenticated internal-player resolver are unchanged. Roles are persisted against `players.id`, never provider subject, email or display name. PLAYER is the absence of a staff assignment. The shared permission registry is `shared/api/adminV1.ts`; `server/admin/permissions.ts` resolves current persisted roles. Every Admin request uses the existing request-scoped authentication/database context and checks its specific permission. Anonymous requests return 401; authenticated PLAYER requests return 403. Mutation authorization is checked again inside the transaction, under the staff-role lock.

| Capability | PLAYER | MODERATOR | ADMIN | OWNER |
| --- | --- | --- | --- | --- |
| Admin panel, player search/inspection, social counts, listing reads | No | Yes | Yes | Yes |
| Marketplace listing cancellation with reason | No | Yes | Yes | Yes |
| Exact internal UUID search | No | No | Yes | Yes |
| Balance/skills/seeds/specimen inspection | No | No | Yes | Yes |
| Signed currency, XP and commodity seed corrections | No | No | Yes | Yes |
| Audit reads | No | No | Yes | Yes |
| Staff role reads and management | No | No | No | Yes |

Permission names: `admin.access`, `player.search`, `player.inspect`, `social.inspect`, `marketplace.inspect`, `marketplace.moderate`, `player.search.internal`, `economy.inspect`, `economy.adjust`, `progression.inspect`, `progression.adjust`, `inventory.inspect`, `inventory.adjust`, `specimen.inspect`, `audit.read`, `roles.read`, `roles.manage`. Higher roles inherit lower permissions.

`server/admin/AdminService.ts` owns projections and transaction wrappers. `server/admin/routes.ts` provides isolated typed routes, with no arbitrary SQL, patch endpoint or public OWNER bootstrap. Development Admin routes require the existing loopback `cactigrow_local` database; remote development still shares production data and is rejected.

## API and bounded reads

All paths below are under `/api/v1/admin`:

| Route | Permission / behavior |
| --- | --- |
| `GET /me` | `admin.access`; role, exact permissions, staff UUID, character, runtime version/environment |
| `GET /players/search?q=...` | `player.search`; 2–80 characters, escaped name search or exact public UUID, at most 25 results; internal UUID requires its additional permission |
| `GET /players/:id` | `player.inspect`; permission-filtered authoritative player projection |
| `GET /specimens/:id` | `specimen.inspect`; read-only ownership, species, clone ID, lifecycle timestamps, Favorite, research depth and active listing |
| `GET /marketplace?offset=...&filter=...` | `marketplace.inspect`; active listings, optional exact listing/seller/specimen UUID |
| `GET /roles?offset=...` | `roles.read`; assigned staff roles |
| `GET /audit?offset=...&actor=...&target=...&action=...` | `audit.read`; bounded recent records and validated optional filters |
| `POST /players/:id/currency` | `economy.adjust` |
| `POST /players/:id/progression` | `progression.adjust` |
| `POST /players/:id/inventory` | `inventory.adjust` |
| `POST /players/:id/role` | `roles.manage` |
| `POST /marketplace/:id/cancel` | `marketplace.moderate` |

Paged results contain at most 50 entries with a next offset; offsets are bounded to 10,000. Search never downloads the account table. Player inspection includes registered status, public character identifier, joined time, Total Level, current role, social relationship counts and up to 50 active listings. Balance, skills, commodity stacks and specimen/Favorite counts require their additional permissions. No Neon identity rows, email, tokens, credentials or raw genetic JSON are projected. "Registered" is not a claim that a suspension system exists.

## Schema, audit and concurrency

`server/db/migrations/0006_admin_roles_audit_v1.sql` adds only `admin_role_assignments` and `admin_audit_log`, their constraints, foreign keys and indexes. It alters no existing gameplay table and requires no backfill. Existing migrations are never rewritten or reapplied. The checked-in Drizzle snapshot/journal correspond to 0006.

Assignments store target player, MODERATOR/ADMIN/OWNER, assigning player and timestamps. Audit records store actor/player role at execution, action, target, reason, safe before/after summaries, command UUID, private request fingerprint and timestamp. Unique `(actor_player_id, command_id)` is also the mutation receipt. Fingerprints are not sent to the browser. Runtime audit access is append-oriented: SELECT/INSERT only, no UPDATE/DELETE.

Every mutation requires an exact command UUID, `confirmed: true`, a 3–240 character trimmed reason and strictly allowed fields. A per-actor advisory lock serializes duplicate attempts. Matching replay returns the original audit without a second mutation or audit; changing target/action/body for the same key returns 409. Current permission is required even for replay after demotion. Audit insertion and gameplay/role changes commit in the same transaction; any failure rolls everything back and produces no success audit.

Role mutations take an exclusive global staff-role transaction lock; other mutations take the shared lock and then recheck permission. This prevents revocation racing with an authorized mutation and serializes OWNER counts. The last OWNER cannot be demoted, even by another actor or concurrent cross-demotion. OWNER promotion requires the exact target UUID again in `confirmOwnerPlayerId`. ADMIN cannot change any role. PLAYER removes a staff assignment. Initial bootstrap is the sole zero-OWNER exception and uses the same exclusive lock plus an `OWNER_BOOTSTRAPPED` audit.

## Corrections and marketplace moderation

`server/gameplay/supportAdjustments.ts` is shared by the Dev Tools and Admin wrappers. Currency is a nonzero signed delta bounded to ±100,000; XP to ±1,000,000 using the existing three skills and XP curve; commodity seeds to ±100 using the current shared Shop catalog. Authoritative rows are locked, nonnegative/storage bounds enforced and existing versions updated. Positive XP uses the existing maximum clamp; audit summaries distinguish requested and applied deltas. No final balance, derived level or arbitrary inventory object is accepted. Own-account successful corrections reconcile existing Grower/lifecycle providers and the HUD.

`cancelMarketplaceListing` in `server/gameplay/commerceTransactions.ts` is shared with normal marketplace cancellation. Staff cancellation uses the same active-listing lock/status/version semantics, preserves specimen ownership and transfers no money. An inactive listing rejects a fresh cancellation; replay confirms the original audited result. Normal purchasing behavior remains unchanged.

## UI and Dev Tools separation

`AdminAccessProvider` loads staff permissions once per authenticated bootstrap and refreshes on panel open, manual refresh, own role change or authorization rejection. Menu → Other → Admin Tools appears only for authorized staff. The existing Feature Panel also guards direct opens. Sections are Overview, Players, Support, Specimens, Marketplace, Roles and Audit Log, filtered by permission; role changes discard private panel state. World routes, Phaser host, position and Town presence remain unchanged.

Support, cancellation and role forms require a reason followed by explicit review/confirmation. An unresolved network/server result retains the same command UUID and payload for retry. A committed result is never presented as an unresolved mutation because a projection refresh failed. The API remains the authority even if hidden React controls are manually enabled. A normal reload is sufficient for a role changed by another staff account; stale UI cannot bypass current server checks.

Production contains Admin Tools but no Dev Tools panel chunk/menu or usable `/api/v1/dev/` routes, including for OWNER. Staging can show both as separate entries. Admin Tools never call Dev Tools endpoints. No growth acceleration or arbitrary specimen creation is available through Admin Tools.

## Owner-only operational runbook

Credentials must be supplied through `CACTIGROW_OWNER_DATABASE_URL` in a secure local process environment/file, never chat, arguments, reports or source control. Use a direct unpooled owner connection. The CLI validates both connection target and `current_database()`/`current_user`; restricted runtime connections are rejected. Local uses loopback `cactigrow_local`, staging uses `cactigrow_staging`, production uses `cactigrow`. Connection/query errors are reported without raw SQL or credentials.

CLI entrypoint: `scripts/admin-owner.ts` (`npm run admin:owner -- ...`). Choose exactly one operation per invocation. Examples assume the secure environment has already been loaded. Replace placeholders only with user-confirmed identities.

```powershell
# Read-only lookup: exact unique character name, no automatic role assignment.
npm run admin:owner -- --environment staging --lookup-name "EXACT CHARACTER NAME"

# Read-only preview: review the displayed target before confirmation.
npm run admin:owner -- --environment staging --player-id STAGING_OWNER_UUID

# Apply only the checked-in additive 0006 SQL to the exact staging database.
npm run admin:owner -- --environment staging --apply-migration --confirm-database cactigrow_staging
npm run admin:owner -- --environment staging --apply-grants --confirm-database cactigrow_staging
npm run admin:owner -- --environment staging --verify-grants

# Explicit first-OWNER assignment after the target preview is accepted.
npm run admin:owner -- --environment staging --player-id STAGING_OWNER_UUID --confirm-player-id STAGING_OWNER_UUID
```

Migration refuses existing/partially existing Admin tables. It records the migration hash/time in the existing Drizzle tracking table when present; it does not create invented history or run other pending migrations. The OWNER command refuses when any OWNER already exists; subsequent role changes use authenticated OWNER role management. Name lookup cannot assign a role even with a confirmation flag. Bootstrap never changes Neon identity mapping or gameplay state.

Exact new privileges, with the separately appropriate runtime role:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_role_assignments TO cactigrow_staging_runtime;
GRANT SELECT, INSERT ON admin_audit_log TO cactigrow_staging_runtime;
-- After staging acceptance only, in production cactigrow:
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_role_assignments TO cactigrow_runtime;
GRANT SELECT, INSERT ON admin_audit_log TO cactigrow_runtime;
```

The CLI verifies these required privileges and absence of audit UPDATE/DELETE, superuser, CREATEROLE, CREATEDB and public-schema CREATE. It does not change unrelated grants or grant migration-table access. Never use runtime credentials for migrations.

### Staging acceptance gate

1. Complete isolated validation and review migration/diff; preserve unrelated user files.
2. Apply staging 0006, verify narrow grants and bootstrap the explicitly intended first OWNER.
3. Confirm authenticated Social startup and existing Farm/Town behavior on the current runtime.
4. Build staging, set `CACTIGROW_DEPLOY_CONFIRM=staging`, use only `npm run deploy:staging` against the existing Worker. Record active version; keep full-host Cloudflare Access intact.
5. With OWNER and normal PLAYER accounts, verify menu/panel/API permissions, distinct Dev Tools entry, OWNER role management and no PLAYER Admin access. Test a confirmed staging account through MODERATOR/ADMIN and back to PLAYER; verify direct server 403 boundaries and current permissions.
6. Perform small explicitly reasoned staging corrections and cancellation using approved test assets. Verify audit exactly once, authoritative HUD/inventory reconciliation, last-OWNER rejection, unchanged world/session and existing normal commerce. Never change staging data merely for a read-only compatibility probe.
7. Obtain actual staging acceptance before proceeding to production. Disposable tests do not substitute for live browser acceptance.

### Production gate

Only after staging acceptance, load the secure production owner connection and repeat the same 0006/apply-grants/verify-grants operations with `--environment production --confirm-database cactigrow`. Preview and confirm the separately intended `PRODUCTION_OWNER_UUID`. Do not reuse the staging UUID without explicit confirmation.

Build production, set `CACTIGROW_DEPLOY_CONFIRM=production`, then use only `npm run deploy:production` against the existing `cactigrow-api-production` Worker. No auth/DNS/realtime/Hyperdrive infrastructure changes are necessary. Record the active version and validate OWNER Admin Tools plus normal-account 403/menu exclusion, Farm/Town/social/profile, unchanged ordinary commerce and production Dev Tools 404/absence. Avoid real-account correction transactions solely to demonstrate buttons.

Rollback is an application version rollback only. Keep additive tables, assignments and audit history; never reverse the migration, delete players or reset data.

## Validation evidence and remaining acceptance

Passed: Admin contract/role and real panel tests; disposable PostgreSQL Admin tests covering 401/403, role transitions, exact audit/idempotency, underflow, rollback when audit insert fails, OWNER promotion/cross-demotion, marketplace ownership/balances, current-role revocation, production Dev Tools rejection, audit immutability, original player preservation and actual panel→typed client→Worker→PostgreSQL→HUD reconciliation. The suite also executes the direct owner CLI against a separate disposable staging-named database for exact migration targeting, grants, lookup and first-OWNER confirmation.

Existing Dev Tools (including real database/UI), marketplace (including real database/UI), menu, Worker and typed-client tests passed. Lint, frontend/Worker type checks, production/staging builds and Drizzle metadata check passed. No dependency was added. Existing bundle-size and PostgreSQL concurrent-query deprecation warnings remain. Live staff-account/browser/mobile acceptance, remote migrations/grants/bootstrap and deployment are pending, not claimed.

For repeatable database validation, set `CACTIGROW_EMBEDDED_POSTGRES_MODULE` to the file URL of the existing isolated embedded PostgreSQL installation, then run `npm run test:admin:db`. The suite creates disposable databases and does not connect to staging/production. Without that module the database suite explicitly skips; a skip is not rollout evidence.

## Mobile and target-confirmation hotfix

Player selection is shared across Players, Support and Roles. An unsubmitted review is invalidated when searching/selecting a target or changing sections; an unresolved submitted command keeps its original target and UUID for replay. Player corrections require an explicit selected internal UUID. Returned receipts must match the authenticated actor, reviewed target and command before success is shown. Reconciliation reads the reviewed target, while the actor's gameplay projection refreshes only for self-corrections. Feedback names the target and shows currency/XP/seeds before, after, applied delta, reason and audit receipt. A zero applied delta is reported as no change; API errors remain visible without a success receipt.

The Admin overlay uses visual viewport width/height and both offsets, temporarily fixes the document at its original scroll position, and restores original inline styles and scroll on close. The bounded panel retains its header/Close while only content scrolls; focus visibility adjustments scroll that container. Controls explicitly retain a minimum 16px font without disabling browser zoom. These changes are scoped to Admin Tools; the shared HUD/world and other Feature Panels retain their architecture.

`test:admin:db` exercises OWNER A correcting a distinct MODERATOR B through the real React panel, typed client, Worker and disposable PostgreSQL in staging and production modes. Currency, Cultivation XP and commodity seeds each change B by +1, preserve A, record the exact actor/target/reason and replay without another mutation/audit. It also checks selection across tabs, stale review invalidation and an API-backed underflow error.

Set `CACTIGROW_TEST_BROWSER_EXECUTABLE` to an existing headless Chromium executable before `npm run test:admin` to include the mobile layout test. It checks actual CSS geometry at 390px and 320px widths with simulated visual viewport keyboard shrink/pan, reachable Close, 16px controls, internal scrolling, document restoration, stable HUD/world nodes and mouse/touch/pointer isolation. This fixture does not simulate Safari's native keyboard or automatic zoom and does not establish authenticated live staging or physical-device acceptance.

An already-open target game session has no staff-correction push channel: its HUD can retain an older snapshot until an authoritative refresh/reload. A successful receipt and the Admin target inspection refer to persisted target state, not another browser's cached HUD. This hotfix does not add polling or change realtime/social/gameplay authority.

## Live player-state reconciliation hotfix

The earlier snapshot-only behavior is superseded by a session-owned observer. `GameHeader` and commerce balances continue to read `GrowerAuthorityProvider.player.tokenBalance`; `GameStateProvider` derives the same balance/XP and inventory from the existing Grower and lifecycle projections. Normal Shop/Marketplace/NPC commands reconcile their authoritative receipts immediately, Dev Tools applies its returned projections, and Admin self-corrections refetch only the actor's own projections. Cross-account Admin corrections and Marketplace seller credits previously persisted without notifying another mounted client. XP and seed corrections shared that stale-snapshot limitation.

The existing Town presence/chat transport has no player-state invalidation event and does not cover Farm, interiors or staging with realtime unavailable. One visible, server-backed game session therefore checks `GET /api/v1/me/authority-revision` every 30 seconds plus coalesced focus/visibility restoration (minimum five seconds between focus-driven checks). Hidden sessions pause; checks do not overlap, have a 15-second abort deadline, and stop after authentication denial. The read is authenticated, owner-scoped, `no-store`, and uses one indexed join over existing profile, Grower and lifecycle version rows. No balances, inventories or new counters are polled. Profile and Grower versions are compared separately because their projection's `Math.max` can conceal a profile-only change.

Changed profile/Grower revisions refetch the existing Grower projection; changed lifecycle revisions refetch the existing lifecycle projection. The first observation refreshes both once to close the initial-load race. Failed, aborted or superseded reads retain loaded state and retry without accepting the revision. Provider generation guards remain in place. Currency deltas are never applied locally; repeated observations and receipt replay cannot double-charge/credit. Offline accounts use normal next-session loading. Healthy visible clients normally observe remote changes on the next 30-second check plus network time; this is bounded observation, not instantaneous realtime push.

`test:reconciliation` verifies selective refetch, distinct counters, coalescing, hidden-session pause, cleanup, transient failure/retry, timeout, auth denial and wire validation. `test:admin:db` mounts two real React provider/HUD/commerce trees with separate authenticated typed clients and disposable PostgreSQL in staging and production modes. It verifies remote currency, XP/seeds, unchanged actor, repeated revision/replay, offline reopening, immediate Shop/Marketplace buyer/NPC reconciliation and observed Marketplace seller credit. The real `PhaserWorldCanvas` lifecycle is exercised with a test game constructor; worlds/feature selections remain mounted. This is automated integration evidence, not authenticated live staging, physical-device or rendered Phaser acceptance. No schema migration, grant, OWNER bootstrap, economy-rule, auth, presence/chat or world change is required.

## Post-close mobile viewport restoration

The earlier close path restored document styles/scroll once and immediately removed visual viewport listeners. The subsequent ordinary focus restoration could move the document again; late keyboard-dismiss viewport events had no remaining correction. The five overlay viewport properties also remained on the detached overlay. These are verified cleanup gaps; reproducing Safari's native zoom on a physical iPhone remains a device acceptance item.

Admin dismissal now blurs its focused control before unlocking the document, restores the five overlay properties and every saved body/root inline property, and restores opener focus with `preventScroll`. A bounded restoration listener repairs late scroll/viewport changes, then removes itself after a quiet, full-height viewport or a 600ms deadline. It emits one normal window resize so the existing Phaser ScaleManager remeasures normal layout. It does not set a second scale, reset camera/player state or recreate the world. Reopening cancels the pending restoration. The already deployed player-state revision observer remains unchanged.

The strengthened staging/production Chromium fixture uses the real `PhaserWorldCanvas` with a rendered Phaser game and checks close from Overview, Support, Players and Roles, keyboard shrink/dismiss, late viewport events, exact root/HUD/world geometry and inline-style restoration, cleaned overlay properties/listeners, unchanged Phaser/player/camera, and rapid reopening. Its viewport events/document pan are simulated; it does not establish physical Safari or authenticated live staging acceptance.

## Source map and deferred scope

- Contracts/permissions: `shared/api/adminV1.ts`; database schema/migration: `server/db/schema/admin.ts`, migration 0006 and its Drizzle metadata.
- Server: `server/admin/{permissions,AdminService,routes,bootstrapOwner}.ts`, `server/api/router.ts`; owner operation: `scripts/admin-owner.ts`.
- Shared authoritative operations: `server/gameplay/supportAdjustments.ts`, `commerceTransactions.ts`; existing DevToolsService/GrowerAlphaService delegate only the equivalent operations.
- Client: existing `CactiGrowApiClient.ts`; `src/features/admin/` access provider, panel and responsive CSS; existing GameSession/Menu/FeaturePanel integration.
- Tests: Admin contract/panel tests, disposable API/database integration and actual UI/Worker integration fixtures; package scripts.

Social inspection exposes counts through existing relationship tables. Existing Town chat transport has no persisted staff mute/report/ban service suitable for this milestone. Mutes, bans/suspensions, reports, cross-API suspension enforcement, full accounting, forced ownership transfers/purchases, price edits, raw genetics visibility, arbitrary specimen creation/deletion and live role push are intentionally deferred. Locked art, game constants, authority, normal commerce, CactiSwap and realtime transport remain unchanged.
