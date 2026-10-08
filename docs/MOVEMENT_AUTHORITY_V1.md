# Movement Authority V1 — staging report

Implementation begins at accepted checkpoint `76ca6bcf2fc1ba9c82ac2b8193b1b295209dfd32`. This is staging implementation and verification, not production promotion or human physical-device acceptance. Source paths below were inspected during this task. Historical statements describe the inspected pre-change source, not a second implementation.

## 1. Previous authority gaps

`FarmTestScene.ts`, `TownTestScene.ts` and `LdtkAreaScene.ts` owned responsive local Arcade movement through the existing `NavigationController`. `AreaConnection.sampleMovement` published client coordinates; `AreaCoordinator.message` checked shape, bounds, sequencing and rates, without enforcing travel speed or collision. Presence samples did not supply persistent gameplay authority. `WorldService.load` restored authored entry spawns; `resolveExit` validated topology/revision/destination without requiring trigger presence. `ExplorationService`, `TownContentService` and `FieldSurveyService` checked submitted endpoints against proximity, navigation and elapsed-time anchors. Those anchors could not validate the intervening movement stream. `StartingExperienceService` checked tutorial Area/target, without accepted-position proximity. Building entry was a client world intent. These specific paths now share movement authority on staging.

## 2. Checkpoint architecture

`server/movement/MovementOwner.ts` uses one player owner named `movement-v1:<authenticated internal UUID>` inside the existing `AreaPresence` namespace/class. Its durable KV state holds internal UUID, generated-world version, runtime Area, world revision, movement revision, accepted and previous positions, server timestamps, rejection diagnostics and consumed travel credit. No binding, DO class, migration or schema is added. `movementPort.ts` constructs fresh binding-only requests; browser requests never forward trusted scope. Private seed operations use canonical server location; coordinate checkpoints cannot seed or select an Area. Staging API and realtime admission initialize the owner; unavailable authority fails closed.

## 3. Update cadence

Completed Phaser physics is observed by `bindMovementAuthority.ts`; keyboard and route followers remain local. The existing socket cadence stays at least 110 ms between changed movement samples, about 9.1 packets/second, capped by existing 10/second Area limits. Each admitted socket sample is validated before publication. Successful self acknowledgements are coalesced to at most twice/second; rejected positions return immediately. Connected clients make a safe-persistence HTTP checkpoint at most once/15 seconds while changing position. Disconnected socket fallback coalesces to one HTTP checkpoint/500 ms with one request in flight. Critical interactions flush the final rendered position before the existing command. Unchanged positions are quiet; no per-frame HTTP or PostgreSQL write.

## 4. Speed and distance validation

`shared/world/movement.ts` supplies the actual 245 units/second speed to renderers, realtime definitions and server validation. The server consumes shortest collision-clear route distance against server elapsed time. Initial latency credit is 350 ms; accumulated travel credit is bounded to 2 seconds plus that tolerance, at most 575.75 units. Credit is consumed, rather than granting another 350 ms on every packet. Client speed and timestamps are not accepted. Nonfinite/out-of-bounds, instant remote movement and stale/fabricated scopes reject without advancing accepted position or revision. Stalls beyond the bounded budget may produce a correction; they do not produce punishment.

## 5. Collision and path validation

`movementRules.ts` caches the existing `NavigationMap` per Area/template. Rough Areas reuse generated LDtk collision. Town uses existing `shared/world/townGeometry.ts`. Farm bodies were extracted byte-for-value from the existing scene into `shared/world/farmGeometry.ts`; the scene and server now consume the same 20 bodies, including existing boundary/post/mail definitions. There is no second authored collision map. Server clearance uses the existing 27-unit physics body with 0.1 numerical contact tolerance; client click routing retains its existing additional 5-unit margin. Endpoints must be physically clear and the route must reach the exact endpoint. The full settlement fixture preserves both historical geometry hashes, Farm 47 navigation nodes and Town 16 nodes. All 21 authored arrivals remain unchanged, including their small first-step Arcade clamp.

## 6. Area transitions

`WorldService.transition` retains authored exit IDs, revision checks, blocked routes, discovery, receipts and target spawns. Physical exits additionally require the accepted position inside the exact authored trigger. The committed destination is then read/seeded before the transition returns; no precommit destination seed can poison authority on rollback. Stale old-Area packets reject. Existing discovered-area Travel remains an explicit authenticated server-authored teleport, not a movement packet. Cave returns to Path 3; reaching Path 4 requires Path 3.

## 7. Farm instance authority

Farm runtime identity remains `farm-<owner public UUID>`, resolved from the authenticated profile and canonical location. The durable owner is keyed separately by internal UUID. All Farm navigation templates can share immutable geometry while position state stays per owner. Another player's Farm runtime ID is rejected as `AREA_CHANGED`; staging realtime admission also requires canonical world scope for Farm and Town.

## 8. Interaction proximity architecture

`interactionProximity.ts` reads accepted authority under the existing onboarding owner lock and exposes range/sight, building and authored-region guards. `/api/v1/me/world-interaction` validates the renderer's NPC/resource/board/building target without awarding anything. Existing reward/contact commands independently validate accepted position, so bypassing the UI gate does not bypass those checks. Farm building centers/radii come from `farmWorldLayout`; Town entrances come from `townGeometry`. Mail retains the existing omnidirectional 160-unit approach contract. Farm HUD facility selection now asks the existing walker to approach the building, then opens the existing interior at the accepted entrance. No camera, art, door, collider or navigation mechanics change.

## 9. Harvesting hardening

`StartingExperienceService` protects tutorial target actions and Lab visits. `ExplorationService` uses accepted authority for wild harvest distance, current Area, clear sight and provenance anchors. Existing resource existence, personal availability, required equipped tool, cooldown, server random 3–10 commodity seeds, 10 Harvesting XP, transaction lock and idempotent receipts remain intact. Submitted command coordinates are retained for wire compatibility but cannot supply staging reward distance. Restricted PostgreSQL tests demonstrate remote rejection and nearby reward acceptance even with intentionally false submitted endpoint coordinates. No rare rewards are added.

## 10. Landmark hardening

Landmark discovery uses accepted position inside the saved authored region in `ExplorationService`; environmental inspections use accepted range and sight. Existing discoveries, Journal history and broad automatic region entry remain compatible. Field Survey Mara conversations/reports and Town first contacts also use accepted authority. No reset of existing discovery, survey or contact history occurs.

## 11. Reconciliation

`WorldMovementClient.receive` rejects stale world/runtime/revision responses and deduplicates retained corrections. Rejection returns the accepted position; the binder cancels the active route, stops/resets the existing Arcade body and closes the current interaction. A fresh valid click or keyboard walk can immediately proceed. Generation fencing handles unmount and StrictMode restart without late snapping. Ordinary lag is corrected, never kicked or banned. Diagnostics log the first and every twentieth rejected movement packet, without credentials.

## 12. Multiplayer result

Actual workerd tests use two Town sockets and the shipped `AreaPresence`: legitimate sequenced movement continues, an impossible move produces sender-only correction and no remote publication, and subsequent legitimate movement resumes. Existing actual two-client admission/layer/reconnect and renderer interpolation tests pass. Remote avatar rendering and interpolation are unchanged. Live diagnostics also exposed reload admission conflict: an old presence can survive 60 seconds while the existing retry sequence stops sooner. The staging World connection now makes one additional delayed retry after HTTP 409, with no replacement of an active owner and no change to production retry behavior. Tests cover recovery, repeated-conflict exhaustion and cancellation. Only one authenticated browser account was available for live review; paired authenticated live acceptance remains separate.

## 13. Persistence

Durable accepted state survives socket/Area-owner restart and browser refresh. Safe accepted snapshots reuse `player_grower_events` with event type `movement-safe-location-v1`, throttled to at most once/15 seconds. Location loads choose a physically valid snapshot for the exact world revision/runtime, else the authored entry spawn; invalid/rejected coordinates cannot enter that write path. Durable state is the freshest source; PostgreSQL fallback can lag up to the persistence interval. Append-only event retention may need a separately scoped maintenance policy at larger population. Tests exercise restart, PostgreSQL fallback, invalid persisted data fallback and rejected-write exclusion.

## 14. Dev Tools

The existing World section adds accepted Area/runtime, x/y, previous point, checkpoint timestamp, world/movement revisions, rejection reason/count, live client/server delta and sanitized realtime failure category. Safe probes exercise out-of-bounds coordinates, a remote authored-point teleport, fabricated Area, remote wild harvest and remote NPC interaction. They use normal authenticated endpoints and do not inject client teleports, reset data, grant tools or bypass reward rules. No movement controls are added to Admin Tools. Existing production Dev Tools gating and production route-before-auth rejection remain.

## 15. Performance impact

Live acceptance exposed `exceededCpu`/HTTP 503 when a cold HTTP authority read eagerly built a navigation graph. `NavigationMap` now supports deferred graph construction for server collision/sight checks and straight checkpoints. Clients retain the original eager default; detours build/cache the identical graph in the durable owner. No infrastructure limit changes were requested. The same all-21-arrivals test fell from approximately 446–468 ms to 1–1.5 ms locally. This compares CPU work; it is not a phone/FPS benchmark. An added test proves exact collision, sight, nodes and detour-route parity.

Local frames have no network dependency. Expected sustained load per moving connected player is about 9 socket validations/private-owner calls and durable state updates/second, up to 2 self acknowledgements/second, and at most 4 persistence HTTP requests/writes per minute plus interaction flushes. Fallback is at most 2 HTTP requests/second and the same write ceiling. No PostgreSQL work occurs in the websocket movement hot path. Maps are cached and Farm geometry is shared. Existing Area serialization awaits the private owner before broadcasting; workerd correctness passes but load testing and physical-device latency/FPS are not established. Final staging Worker upload is 2060.09 KiB, gzip 254.36 KiB; observed startup 24 ms. Existing Vite large-chunk warnings remain.

## 16. Staging Worker

Guarded wrapper: `CACTIGROW_DEPLOY_CONFIRM=staging npm run deploy:staging`, with the existing isolated CactiGrow Cloudflare configuration. Task baseline `fc02bc50-19d0-4c3b-8d89-f05aa819c4f6`; final version `cc6828ab-525c-404e-8143-2ff1621fde05`, deployment `deab2754-0f8f-4351-8abd-55a91a67b4a6`, 100% at `dev.cactigrow.com` from `2026-10-08T22:22:26.464765Z`. Live final asset is `/assets/index-DxAqcfaM.js`. Read-only staging preflight passes for `cactigrow_staging` / `cactigrow_staging_runtime` and existing grants. No production deploy, infrastructure, Access, DNS, binding, identity, schema/grant change or direct staging data administration.

Release review found and corrected the cold-request CPU failure described above. A later staging upload briefly used the local production build, hiding `/world`; an explicit staging rebuild/redeploy restored it, and the served World/Dev Tools client was checked. The guarded deployment wrapper chooses the environment but does not build assets. Future releases must finish the explicit staging build after any local production-exclusion build.

## 17. Tests, build and lint

Accepted-checkpoint preflight: Movement 28, multiplayer client 10 and Worker/types freshness 42 pass with zero failures/skips; lint and both local production/staging builds pass. Movement coverage includes isolated restricted PostgreSQL and actual workerd. This commit/push preflight performs no deployment or live database/configuration change.

340 passing executions, zero failures/skips in the completed suites (counts overlap): Movement 28; World/Exploration/Survey/Town combined server/content regressions 95 with restricted real PostgreSQL; navigation/minimap/realtime/admission/chat/client/menu/Dev Tools combined 141 including actual two-client workerd, plus the added reload-conflict test; Worker/types freshness 42; Starting 29 with restricted PostgreSQL and full fresh Chrome onboarding with authority enabled; Town/Survey/Settlement Chrome fixtures 3; full World Chrome 1 with all 26 physical transitions, 960 character poses and 80 protected-eye checks. Final affected client suite passes 12 tests, including actual two-client workerd. Production/staging local builds, lint, Worker checks and staging dry run pass. Existing chunk-size/pg warnings remain. Fixture Town/Survey APIs explicitly control content responses; those fixtures do not prove authenticated movement authority. Engine input-series tests exercise the shared checkpoint contract; actual rendering/input behavior is additionally exercised by the browser regressions and live walk.

| Requested check | Evidence |
|---|---|
| 1–4 normal/keyboard/world click/minimap | Speed-series unit tests; fresh full-app onboarding; unchanged actual Phaser input/minimap fixtures; live review below |
| 5–8 teleport/bounds/barrier/latency | Movement rules tests, cumulative-credit attack test, actual workerd teleport, safe live probes |
| 9–11 transition/forged Area/private Farm | Authenticated staging API + restricted PostgreSQL; immediate destination-owner assertion; owner scope tests |
| 12–15 near/remote harvest and NPC | Staging API + restricted PostgreSQL, service/guard tests, live probes |
| 16 landmark presence | Authored region tests and service regressions |
| 17–18 rejected persistence/refresh | Restricted PostgreSQL accepted fallback/restart/invalid snapshot tests; live reload below |
| 19 two-player Town | Actual workerd and actual two-client tests; paired authenticated live pending |
| 20–21 path/world/chat/Travel/minimap | Combined 141, full World and Settlement Chrome fixtures, World Travel component test |
| 22 production Dev Tools absent | Runtime gate tests, production HTTP/private binding 404 tests, local production build |

## 18. Live acceptance

One authenticated Chrome account, Staging Tester 2, was available. Keyboard, world click and minimap walking exercised Farm to Cross Path, Path 3, Basin Cave, return to Path 3, Path 4, and The Basin. The return reached Path 4 physically, then used the existing discovered-destination Travel to Town. A complete physical Basin-to-Town return is still pending. No account/data reset or external message was performed.

Safe live probes rejected remote wild harvest at Cross Path and remote NPC interaction at Town. On final asset `/assets/index-DxAqcfaM.js`, normal-API probes returned `OUT_OF_BOUNDS`, `TOO_FAST` and `AREA_CHANGED`, preserving Town position `(962.9660617893408, 1216.3771001164796)`. Remote NPC returned "Approach this place before interacting." Nearby Rosa opened her ordinary repeat dialogue after actual world-click walking. After the cold-request fix, nearby Basin wild harvest returned HTTP 200 and visibly entered "Pods regrowing"; reload restored the accepted Basin position. Final Town reload after invalid probes restored the exact accepted coordinates above. Currency remained $25 and total level 7; exact live wild reward quantity was not recorded.

Final Town diagnostics showed connected realtime, zero resting client/server delta and no transport error. After the three invalid-checkpoint probes and reload, legitimate world-click walking resumed; final accepted position was `(1114.0213993967568, 1119.1022519211697)`, world revision 118, movement revision 81, with exactly three retained probe rejections and `accepted: true`. The outbound Basin walk had zero movement rejections; a stale Area packet at the Basin-to-Path-4 handoff was rejected without poisoning destination state. HTTP fallback worked during realtime unavailability. An immediate reload revealed admission 409 while the previous presence lease was active; reconnect after expiry worked, and the added bounded grace is covered by client tests. This does not establish paired authenticated live smoothness.

The desktop live walk was very slow, as also recorded before this task in the Town baseline. No repeated movement corrections explained that slowdown, and browser visibility read as visible. Unchanged movement feel/performance is therefore **not accepted** from this run. Physical iPhone/Safari, FPS/load, protected logout/OTP relogin and paired live accounts remain unperformed. Automated fresh-app/input/navigation/rendering tests are separate evidence.

Final 390x844 responsive review restored the exact accepted Town point and displayed the existing HUD/minimap within the viewport, with no horizontal overflow. Normal viewport was restored; the account was left at the accepted Town position with no modal/panel open. Evidence under `.wrangler/movement-live/`: `live-final-nearby-rosa.jpg`, `live-final-teleport-rejected.jpg`, `live-final-area-rejected.jpg`, `live-final-mobile-restored.jpg`, `live-final-authority.jpg`, `live-final-town.jpg`, and `live-nearby-harvest-regrowing.jpg`. These are ignored review artifacts, not new tracked gameplay assets.

## 19. Files changed

Existing runtime: `server/api/router.ts`, `server/exploration/ExplorationService.ts`, `server/exploration/explorationReach.ts`, `server/quests/FieldSurveyService.ts`, `server/realtime/AreaCoordinator.ts`, `server/realtime/AreaPresence.ts`, `server/realtime/admissionRoutes.ts`, `server/starting/StartingExperienceService.ts`, `server/town/TownContentService.ts`, `server/world/WorldService.ts`, `shared/realtime/areas.ts`, `shared/realtime/protocolV1.ts`, `src/features/devtools/DevToolsPanel.tsx`, `src/features/social/SocialContext.tsx`, `src/game-world/AreaExitController.ts`, `src/game-world/FarmTestScene.ts`, `src/game-world/LdtkAreaScene.ts`, `src/game-world/LdtkWorldPage.tsx`, `src/game-world/TownTestScene.ts`, `src/game-world/worldTypes.ts`, `src/game-world/navigation/NavigationMap.ts`, `src/services/api/CactiGrowApiClient.ts`, `src/services/realtime/AreaConnection.ts`.

Existing tests/config/docs: `package.json`, `server/starting/startingUiAcceptance.mjs`, `server/world/world.integration.test.mjs`, `src/features/field-survey/fieldSurvey.browser.test.mjs`, `src/features/town-content/townContent.browser.test.mjs`, `src/game-world/worldTravel.runtime.test.mjs`, `src/services/realtime/AreaConnection.test.ts`, `PROJECT_CONTEXT.md`. Legacy topology-only world integration now uses the test environment; the new authenticated staging integration independently exercises physical authority with a real restricted database. Fixtures adapt to the new gate rather than weakening shipped staging checks.

New runtime: `server/movement/MovementOwner.ts`, `server/movement/movementRules.ts`, `server/movement/movementPort.ts`, `server/movement/interactionProximity.ts`, `shared/api/movementV1.ts`, `shared/world/movement.ts`, `shared/world/farmGeometry.ts`, `src/game-world/WorldMovementClient.ts`, `src/game-world/bindMovementAuthority.ts`, `src/features/devtools/MovementDevInspection.tsx`, `src/features/devtools/movementDiagnostics.ts`.

New tests/report: `server/movement/movement.test.ts`, `server/movement/movement.integration.test.mjs`, `server/movement/movement.runtime.test.mjs`, `server/movement/movementTestNamespace.mjs`, `src/game-world/WorldMovementClient.test.ts`, `docs/MOVEMENT_AUTHORITY_V1.md`. Total 48 task paths. LDtk, generated world, all art/public assets, database migrations, wrangler configuration and dependencies are unchanged. Three unrelated files remain byte-identical to the pre-task checkpoint's exclusion hashes: production archive, Garden NPC audit and benchmark report.

## 20. Commit/push status

The user accepts Movement Authority V1 as the current staging development baseline and explicitly authorizes a scoped commit and push to `main`. This acceptance supersedes the implementation-time commit/push and review holds. The accepted checkpoint includes authoritative movement, Area/collision/path/transition/Farm validation, interaction proximity and harvest/NPC/landmark hardening, correction and safe restoration, staging diagnostics, tests and documentation. Historical validation and unperformed manual checks remain recorded above; acceptance does not claim those checks were performed.

The implementation started at `76ca6bcf2fc1ba9c82ac2b8193b1b295209dfd32`. Final commit/push and synchronization results are reported in the checkpoint handoff. Authorization is commit and push only; this checkpoint performs no deployment or production database/configuration change. Preserve `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, and `local-ai-benchmark-report.txt` unchanged and outside the commit.

## 21. Remaining authority gaps

This validates plausible checkpoint routes; it does not simulate every frame or prove the client's actual path between accepted endpoints. A reachable detour within the consumed budget can be accepted. The bounded 575.75-unit allowance intentionally tolerates silence/lag and is not continuous server navigation. Facility world intents are gated, but existing remotely accessible feature menus/interior URLs and all commerce APIs are not converted into a new physical presence entitlement system; existing commerce ownership/atomicity remain. Production remains its previous implementation. Multiple simultaneous browser sessions share one player owner; checkpoints are serialized, but inputs do not have a new cross-transport session epoch. A delayed physically plausible packet can briefly move accepted state backward within the same Area. Do not claim kernel anti-cheat, bans, founder-reward security, physical-mobile smoothness or paired authenticated live acceptance from these tests.

## 22. Recommended next gameplay milestone

Complete paired-account/physical-phone acceptance and a staged load/latency run first. Then a small ordinary-reward exploration/content milestone can use this foundation while preserving current economy/genetics. Separately define rare/founder reward threat requirements, cross-session fencing and any stronger server navigation before enabling valuable tradable wild rewards.
