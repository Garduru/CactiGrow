# CactiGrow Dev Tools V1 — 2026-10-03

Internal development tooling. Production deployment is expressly excluded from this milestone.

## Ongoing local and protected-staging workflow

Dev Tools target **local development and protected staging at `https://dev.cactigrow.com`** using the same implementation. Production is excluded.

1. Implement and validate locally against the isolated `cactigrow_local` database with server lifecycle enabled.
2. Validate Dev Tools gates, authenticated commands, projection reconciliation and Farm/Town input/scene preservation; run lint, Worker typecheck and both staging/production builds. The production build is a gating check only.
3. Verify the live staging Hyperdrive still targets `cactigrow_staging` and full-host Cloudflare Access remains intact. For an application-only release with no new migration/grant requirements, check compatibility through the existing authenticated runtime/read projections; unavailable owner SQL credentials alone do not block upload. Stop for unclear database isolation or demonstrated missing schema/privileges. Never substitute the shared remote development/production database or apply migrations/change grants without separate authorization.
4. Build staging last, then use `CACTIGROW_DEPLOY_CONFIRM=staging` and `npm run deploy:staging` under the existing [staging runbook](DEPLOYMENT_STAGING_FOUNDATION.md). Record the source commit, Worker version and prior rollback version.
5. Validate the authenticated staging menu/panel, diagnostics, snapshot and unchanged Farm/Town mounts, position, connection and input boundaries. Exercise small owner-scoped dev commands only when staging-data changes are authorized; otherwise use disposable integration tests and explicitly report the live mutation check as unperformed. Anonymous Access redirects prove protection only.

Do not deploy production solely for Dev Tools changes. Changes to shared normal-game code require a separate explicit production-release decision. Preserve the existing production environment gate and infrastructure.

Local and staging share the same sections and authoritative commands. Local mutations require the loopback `cactigrow_local` target; staging mutations require verified Access identity and the isolated staging database. World/visual previews stay temporary in both. Realtime diagnostics report the existing environment's actual connection; a staging deployment does not provision multiplayer or force a reconnect. Owner provisioning scripts, full-account wipes and deferred controls are not panel actions. The separately authorized Starting Experience reset is documented below.

## Discovery and consolidation

Inspected current source and contracts before implementation. Existing utilities were:

- `src/dev/PlantVisualTestTool.tsx` and `plantVisualTestModel.ts`: isolated canonical art specimens, Nursery/Plant Details previews and temporary Farm Garden render projection, previously opened with `?plantTest`. Governed by `docs/PLANT_VISUAL_TEST_TOOL.md`.
- `src/game-world/editor/`: existing temporary World Editor controller, panel and Phaser geometry overlay, previously opened with `?worldEdit`. Governed by `docs/WORLD_EDITOR.md`.
- Farm/Town scene and game factories: development `?worldDebug` physics, geometry, camera and navigation diagnostics.
- `src/services/api/developmentCredentials.ts` and `server/identity/DevelopmentIdentityProvider.ts`: explicit Account A/B development selection, not a general admin account.
- `server/development/provisionSeedFixtures.ts` and `server/staging/provisionSeedFixtures.ts`: owner-side, explicitly enabled provisioning scripts, not in-game cheat endpoints. They remain separate operational tools; no browser access to owner credentials was added.
- `.wrangler/local-dev/README.md`: existing isolated persistent local PostgreSQL and Account A/B launcher. Prototype reducer fixtures and visual preview specimens are not authoritative testing controls.

Search covered dev/debug/developer/admin/testing, seeds/currency/XP, spawn/teleport, lifecycle/research/breeding, inventory/specimens, Garden/Nursery/Farm/Town and player-state utilities. No existing general privileged in-game XP, currency or lifecycle command surface was found. Normal research, Favorite, property-upgrade, commerce and lifecycle actions already existed and are reused.

## Architecture and commands

One entry at **Menu → Other → Developer Tools** opens the existing Feature Panel. Internal sections show one tool category at a time. Visual Testing embeds the existing plant tool; World embeds the existing World Editor and invokes existing collision/navigation overlays. Legacy query shortcuts open the unified interface. Opening the editor dynamically attaches its existing controller to the current scene without changing its host or Town connection.

World and Visual Testing offer an explicit **Dock panel for world preview** mode. It makes only Dev Tools nonmodal so the existing canvas drag/zoom/movement previews remain usable. Ordinary Dev Tools and all other feature panels retain modal input isolation. Closing restores normal UI and returns the editor to Test Movement with no selected geometry. Editor drafts remain temporary; locked source/config/art is never written.

`/api/v1/dev/session`, `/api/v1/dev/commands` and `/api/v1/dev/specimen?id=...` are authenticated and owner-scoped. No SQL/row/JSON-patch endpoint exists. `DevToolsService` implements four explicit domain operations over the existing authoritative schema:

| Command | Limits and semantics |
| --- | --- |
| `add-xp` | Actual skill registry; 1–1,000,000 XP per request. Uses existing `addXp` clamp and XP-derived levels. |
| `add-currency` | $1–$100,000 per request; rejects storage overflow. Updates existing balance/version. |
| `adjust-seeds` | Shared Shop species catalog; nonzero -100–100 quantity; rejects underflow/overflow. Locks/version-updates existing inventory stack. Negative UI adjustments require confirmation. |
| `advance-growth` | Owned growing Nursery specimen only; 1–60 minutes or complete schedule. Preserves specimen/clone IDs, genetics, original `plantedAt` and rule constants. Uses occupancy-before-specimen locks, matching normal collection. Normal collection still awards normal outcomes exactly once. |

Commands validate exact keys and canonical UUIDs, reject supplied actor IDs, use the existing request database context, row locks, atomic transactions and existing command receipts. A per-player dev advisory lock serializes duplicate receipt attempts. Replays return fresh authoritative Grower/lifecycle projections without repeating mutations. Those validated projections reconcile the existing providers immediately, including HUD/inventory; no extra game-state store or reload exists. An unresolved command can be retried with the exact body/ID. Definitive 4xx rejections release the pending command.

## Environment isolation

UI uses the existing deployment-mode resolver: development/staging only; unknown modes fail closed to production. Production cannot open Dev Tools programmatically and the production build excludes its UI chunk.

The Worker rejects the dev surface before authentication/database acquisition in production, unknown/test environments, and the public apex/www domains. Protected staging uses its existing verified Cloudflare Access identity path. Development commands additionally require the existing loopback `cactigrow_local` database target. This is a database isolation check layered on the existing environment gate, not a hostname-only UI check. The remote development database shares production data; its dev-command requests are deliberately rejected.

No production auth, Neon endpoint, DNS, Access policy, schema, migration, runtime grant or deployment configuration was changed.

## Implemented sections

- **Overview:** environment, authenticated public name/internal UUID, active world/Area/position, total level, currency, Garden level, multiplayer status/layer and Worker version. Copy UUID/open own profile.
- **Progression:** actual Cultivation/Breeding/Genetics XP, levels, remaining XP, presets/custom additions. Garden building progression has no separate XP. Organized Beds uses the normal eligibility/cost/purchase path; no fake unlock flag. Use a still-Level-1 local Account B for below-gate testing and a legitimately upgraded account for above-gate testing.
- **Economy/Inventory:** immediate authoritative currency and seed adjustments, current stacks and shared catalog.
- **Plants:** searchable owned/growing specimens, species, owner, IDs, lifecycle timestamps, Favorite/research, developer genetic identity, lineage and server-calculated NPC value/commerce protection. Growth controls and normal Favorite mutation. Create physical test specimens by adding seeds and using normal Nursery planting/collection.
- **Research & Breeding:** existing next research milestone, exact Genetics gate, knowledge projection and normal observe/analyze actions. Pair diagnostics reuse actual `canBreed`; no override or breeding automation.
- **World:** active scene ID, current-world safe reset, position/destination/waypoint count, existing editor and collision/path overlays. Town connection/layer/remote-player count is read from the existing `AreaConnection`; Farm correctly reports no registered multiplayer Area.
- **Social:** public name, friends/incoming/blocked counts, existing own profile/Friends conveniences.
- **Visual Testing:** existing deterministic isolated plant visual tool; temporary Garden render preview is cleared on close/unmount. No durable specimen/XP award.
- **System:** Worker version, authenticated API reachability, auth/bootstrap/authority, pathname/current panel/world session and clean snapshot.

## Snapshot and action feedback

Copy Debug Snapshot uses an explicit field allowlist, including nested position and multiplayer fields. It omits query/hash, tokens, cookies, credentials, provider subjects, emails, DB URLs and reconnect credentials. It includes a timestamp, public name/internal UUID, levels, currency and diagnostic session/world information. The 40-entry action log exists only in module memory for the current SPA session and never reaches a database or localStorage.

## Verification

Passed:

- Production and staging builds; ESLint; Worker typecheck; diff checks.
- Dev Tools infrastructure: 6 tests (environment/public-host/shared-data rejection, authentication, strict inputs, four-mode UI availability, snapshot allowlist, actual scene diagnostic adapters).
- Real disposable PostgreSQL dev integration: 1 end-to-end test using the existing runtime privilege pattern. Covers duplicate/concurrent receipt replay, ID reuse conflict, XP/currency/seeds, underflow/unknown species, foreign/missing specimens, preserved growth identity/timing, normal collection, Favorite commerce protection and actual React providers/client/Worker/DB reconciliation of HUD/derived levels/inventory.
- Existing Worker (34), client (23), lifecycle/breeding (9), menu (7), navigation (12), multiplayer client/workerd (9), collection (7), Garden sale (10), and disposable PostgreSQL commerce (4) tests.

Farm/Town menu runtime regression opens Dev Tools, copies a snapshot, docks/restores/closes and verifies unchanged host instance, position, route, bootstrap and presence start/stop counters. Scene-adapter tests execute actual Farm/Town registration/reset code with renderer fixtures and verify current-world spawn, stable scene ID, unchanged connection lifecycle, debug cleanup and no production handle. These are automated source/runtime checks, not visual Phaser acceptance.

Existing build chunk-size warnings remain. The existing PostgreSQL code emits a pg concurrent-query deprecation warning; tests pass. No dependency changes were made.

Browser tooling reported no available browser; creating an in-app browser also failed. Desktop/mobile visual acceptance remains manual. The already-running local Worker on 8788 timed out on bounded health/dev-session probes; its existing processes were preserved. Disposable database/UI integration passed independently of that local process.

## Deployment and git scope

### Protected-staging rollout attempt - 2026-10-03

The existing live staging Hyperdrive `cbb6243e55f24865bf34f3b8bf66a641` was read-only verified as `cactigrow_staging` / `cactigrow_staging_runtime`, with caching disabled. Production Hyperdrive targets the distinct `cactigrow` / `cactigrow_runtime` database/role on the same Neon endpoint. No binding was changed. The authenticated old staging Farm/Nursery loaded existing progression and six occupancies before upload. Owner SQL credentials were unavailable; the user explicitly authorized existing-runtime compatibility checks without migrations, grants or staging-data changes.

Source `5b594c090054fa3c92914b3d6e31d06b473d4351` (Dev Tools implementation `08ee097` plus workflow documentation) was uploaded through the guarded staging wrapper as Worker `dcdce225-21ae-4776-a069-117bc5fdfcc2` at `dev.cactigrow.com`. Access remained intact. Authenticated startup then stopped at **Profile unavailable**. A bounded Worker tail confirmed an unexpected error on `GET /api/v1/me/social` (request `be2aeed7-ce42-4814-b69b-804a6ac3dbe9`); the existing safe logger exposed only `errorName: Error`. Checked-in Social V1 uses migration `0005_majestic_fenris.sql` and the existing profile/relationship tables, but this evidence does not identify a missing table or distinguish missing schema from permissions or another server failure. No such cause is claimed as verified.

The existing runbook's application rollback restored prior Worker **`294bb700-556f-4229-a5c2-63007443e3e5` at 100%**. At that checkpoint Dev Tools were unavailable and authenticated acceptance was blocked by Social compatibility. No live dev mutation, schema, migration, grant, provisioning, Access-policy, secret or production change was made during that attempt. The successful diagnosis and rollout below supersede this historical status.

Both builds, lint, Worker typecheck, Dev Tools (6), disposable PostgreSQL Dev Tools (1), Worker/Access authorization (34), client (23) and menu/input/world-preservation (7) tests passed during this attempt. The existing chunk-size and pg concurrent-query warnings remain. Live production health returned 200; read-only requests to all three dev routes returned 404 and its entry asset stayed `index-DstPQNfZ.js`. Anonymous staging SPA/bootstrap/lifecycle/dev-session probes continued to redirect to the existing Access team domain.

### Social diagnosis and successful protected-staging rollout - 2026-10-03

**Root cause: missing staging schema, not an authentication or Dev Tools defect.** A read-only remote preview using the existing staging Hyperdrive ran the actual `SocialService.overview` and reported `operation: social.profiles`, SQLSTATE `42P01`, relation `player_profiles`, classification `missing-relation`. A catalog check across all schemas independently found none of `player_profiles`, `friend_requests`, `friendships`, or `player_blocks`. The checked-in additive `0005_majestic_fenris.sql` creates these tables, constraints and indexes without resetting or rewriting existing player/gameplay rows.

Inspected request path: `server/api/handler.ts` → `server/api/router.ts` → `server/auth/authentication.ts` → existing verified Access identity adapter/resolver → `server/staging/initializeGrower.ts` → `server/player/SocialService.ts` → Drizzle schema/query results → `shared/api/socialV1.ts` projection → `server/api/response.ts`. Database acquisition remains in `server/db/client/database.ts`; identity persistence remains in `server/db/repositories/PostgresPlayerIdentityRepository.ts`. No authentication/bootstrap redesign was necessary.

Overview read dependencies are:

| Table | Required fields / purpose |
| --- | --- |
| `player_profiles` | `player_id`, `public_id`, `display_name`: public summary identity |
| `players` | `id`, `created_at`: membership date |
| `player_onboarding` | `player_id`, `cultivation_xp`, `breeding_xp`, `genetics_xp`: derived skills |
| `plant_specimens` | `owner_player_id`, `lifecycle_status`: owned collection count |
| `bred_seeds` | `owner_player_id`: bred-seed count |
| `friendships` | `player_low_id`, `player_high_id`, `created_at`: current relationships |
| `friend_requests` | `id`, `from_player_id`, `to_player_id`, `status`, `created_at`, `updated_at`: pending requests |
| `player_blocks` | `blocker_player_id`, `blocked_player_id`, `created_at`: blocked players |

The overview requires SELECT on these projection tables; normal identity/onboarding uses its existing separate runtime permissions. An absent profile is valid `ownProfile: null` and proceeds to ordinary character-name onboarding. It is not a reason to change response shape or seed existing players again.

The user applied migration 0005 and Social grants to `cactigrow_staging` through owner access outside the agent tools. Independent read-only runtime checks then verified all four tables and the exact narrow privileges: profiles and requests SELECT/INSERT/UPDATE with DELETE denied; friendships and blocks SELECT/INSERT/DELETE with UPDATE denied. Runtime superuser, role/database creation and public-schema CREATE remained denied. Existing projection-table SELECT checks passed. No owner credential was obtained, invented or stored; the agent applied no migration or grant.

Scoped source commit **`6270b1e88aa82849942ce1801563e2de212625b2`**, pushed to `origin/main`, retains sanitized server diagnostics for staging GET `/api/v1/me/social` only. `server/player/socialReadDiagnostics.ts` preserves the named operation and traverses nested causes for allowlisted SQLSTATE/relation/column/classification; no raw SQL, parameters, database URL, credential, provider subject, email, detail or stack is logged. Client errors remain generic. Existing queries, authority and authentication are unchanged. Regression tests cover nested PostgreSQL causes, safe metadata and staging/path/method gating.

A diagnostic-only staging Worker `c2449615-7b44-430c-802d-82e0cb31db1c` retained the prior UI and exposed the current authenticated Social read. Its same-origin authenticated browser check returned **HTTP 200 with a valid projection** before the full Dev Tools release. The temporary diagnostic page is absent from the full release. The guarded staging wrapper then deployed source `6270b1e` as **`b65d3368-4764-45a4-a3ec-8d85fc1fa1b5`**, independently confirmed active at **100%** on the existing `cactigrow-staging` Worker and `https://dev.cactigrow.com`.

Live authenticated acceptance passed Farm and Town startup, public profile and Friends, Menu → Other → Developer Tools, authenticated Overview/Progression/System/Social reads, and snapshot inspection/copy success feedback. The existing tester completed ordinary profile onboarding as **Staging Tester**. Authorized small commands changed currency **$1,020 → $1,021** and San Pedro seeds **0 → 1**, immediately reconciling the UI; currency persisted on Town navigation. No XP, growth, sale, reset or destructive command was exercised. Town position `(1100, 1280)` and world session stayed identical across Dev Tools close/reopen. Its existing multiplayer status remained **unavailable**; staging realtime is not enabled, so live connection/presence acceptance is not claimed. Farm/Town mount/input/presence preservation also has the existing automated regression coverage. Snapshot rendered fields were checked and copy reported success; browser clipboard contents and screenshots could not be independently captured by the connected tooling. Desktop/mobile preview/editor visual acceptance remains separate.

Anonymous staging `/`, `/api/health`, `/api/v1/me/social` and `/api/v1/dev/session` continued returning 302 to the existing Cloudflare Access team domain. Production health remained 200, all three dev routes returned 404 on read-only requests, and entry asset remained `index-DstPQNfZ.js`. Production was not deployed; its database, grants, auth, DNS and infrastructure were not modified.

Current validation passed production/staging builds (production build only checks exclusion), lint, Worker typecheck, Worker tests **42**, Dev Tools tests **6**, menu/input tests **7**, and real disposable PostgreSQL Dev Tools integration **1**. Existing chunk-size and pg concurrent-query warnings remain. Diagnosis changed only `SocialService.ts`, new diagnostic helper/tests, `handler.ts` and the Worker test script; this report and project context record the result. No migration/config/dependency files changed. Unrelated ZIP/audit/benchmark files and ignored temporary diagnostics remain excluded from commits.

Original implementation initially had source/build validation only and deferred staging. The successful rollout above is now authoritative. Use the existing isolated local launcher and bookmarked `/play?developmentIdentity=account-a&e1Lifecycle=server` (or Account B) for broader local manual acceptance. No production deployment is authorized by this milestone.

Release commit title: `feat: unify development tools with authoritative dev commands`. The exact commit hash and push result are recorded in the final handoff/git history. The existing production-source ZIP, NPC-sale audit report and local benchmark report are excluded.

Changed paths are confined to `server/development/{DevToolsService,devToolsGate,devTools.test,devTools.integration.test,devToolsUi.integration}`, `server/api/router.ts`, `shared/api/devToolsV1.ts`, `src/features/devtools/`, `src/features/menu/`, `src/components/layout/UtilityMenu.tsx`, the existing Grower/lifecycle providers/contexts and GameSession, deployment-mode helper, Farm/Town scene diagnostics/Farm visual projection, existing World Editor host/overlay, existing plant-tool embedding, typed API client, package test scripts, this report and the project-context milestone.

Intentionally deferred: balance/XP setters and account resets; Garden downgrade/fake unlocks; specimen deletion/arbitrary creation; research reset/override; forced commerce; arbitrary teleport; realtime reconnect button; absent health/Zone systems; full frontend build-ID instrumentation. No harvesting/tutorial/automation/CactiSwap work.

Manual acceptance:

1. In local server-authority Farm/Town, open Menu → Other → Developer Tools; record position/session/layer, add a small amount of XP/currency/seeds and close. Verify the same world/position/connection and updated HUD/Inventory.
2. Plant normally, advance/complete that owned specimen and collect normally; verify IDs/genetics/original planting time remain. Confirm another account cannot inspect/accelerate it.
3. Test Organized Beds below and above its real purchase gate using separate local accounts; verify normal research eligibility and Favorite protection.
4. Dock World/Visual Testing; exercise existing editor dragging/numeric previews/debug overlays and plant previews, then close and confirm normal world input/render assignments return. Check desktop and narrow-screen controls/scrolling.
5. Inspect copied snapshot for omitted private fields. Verify production build has no Dev Tools entry and production manual API requests return 404 before any privileged mutation.

### Starting Experience reset extension � 2026-10-06

System includes Reset Starting Experience with explicit target UUID confirmation. Authenticated self-reset is owner-scoped; another account requires existing progression.adjust and inventory.adjust permissions under the staff authorization lock. The existing dev environment gate excludes production, public hosts and shared development data. The reset uses the canonical onboarding lock and revisioned tutorial/world events, preserves identity/name and normal gameplay, retires only tutorial-provenanced practice inventory, and records a persisted reset event plus the session action log. Normal harvest seeds are never credited twice across resets. No full-account wipe, migration, grant or production action is added. Full persistence/acceptance details: [STARTING_EXPERIENCE_V1.md](STARTING_EXPERIENCE_V1.md), confirmed-reset appendix.


### Full character onboarding reset

System's Reset mode distinguishes Reset Starting Experience (retain name) from Reset Full Character Onboarding (existing name form, then appearance). Exact target UUID confirmation, authenticated owner/staff permissions and command-bound persisted audit/replay behavior apply to both. Full reset preserves stable public profile/account identity; old display-name onboarding is inactive until normal name selection. Neither mode deletes normal records. Appearance setup has a collapsed, build-gated staging/local entry reusing the same action before the menu exists. Production excludes both reset UI chunks and rejects the route before auth/database access.
