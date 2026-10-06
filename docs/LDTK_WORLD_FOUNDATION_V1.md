# LDtk World Foundation V1

Source: `world/cactigrow-world.ldtk` (LDtk 1.5.3). World layout is Free; Levels are embedded, simplified export is off, image export is None, and there are no tilesets. The original 16px IntGrid and all Level rectangle dimensions/world positions are preserved. Original `Player_Spawn` definition remains unused; no existing entities were removed.

## World → Zone → Area

`cactigrow-world` contains `starting-zone` / Starting Zone and `first-basin` / The First Basin. Each LDtk Level has an explicit stable `areaId`, independent of its identifier and display name.

| Actual Level identifier | Stable Area ID | Zone | Type | Topology rectangle | Runtime dimensions |
|---|---|---|---|---|---|
| Starting_Spawn_Tutorial_1 | starting-spawn-tutorial | starting-zone | tutorial | 672 × 352 | 672 × 352 |
| Path_1 | path-1 | starting-zone | path | 512 × 256 | 512 × 256 |
| Cross_Path_1 | cross-path-1 | first-basin | path | 256 × 256 | 256 × 256 |
| Player_Farm | player-farm | first-basin | farm | 576 × 416 | 3000 × 1900 |
| Town_p1 | town-p1 | first-basin | town | 432 × 416 | 2200 × 1500 |
| Path_2 | path-2 | first-basin | path | 512 × 256 | 512 × 256 |
| Path_3 | path-3 | first-basin | path | 256 × 480 | 256 × 480 |
| Basin_Cave | basin-cave | first-basin | cave | 432 × 384 | 432 × 384 |
| Path_4 | path-4 | first-basin | path | 608 × 336 | 608 × 336 |
| The_First_Basin | the-first-basin | first-basin | wilderness | 1184 × 768 | 1184 × 768 |
| Path_5_Under_Construction | path-5-under-construction | first-basin | path | 256 × 256 | 256 × 256 |

Authored routes are bidirectional: Starting Spawn ↔ Path 1 ↔ Cross Path; Cross Path ↔ Farm; Cross Path ↔ Path 2 ↔ Town; Cross Path ↔ Path 3; Path 3 ↔ Cave, Path 4 and Path 5; Path 4 ↔ First Basin wilderness. These explicit exit entities replace runtime inference from LDtk's rectangle-neighbour metadata. Town is reached through Path 2, not a newly invented direct Cross Path connection.

## LDtk schema and compatibility bridge

Level fields: `areaId`, `zoneId`, `zoneDisplayName`, `displayName`, `areaType`, nullable `runtimeWidth`/`runtimeHeight`, nullable `travelDestinationId`. `zoneId` has an authored anchored regex enumerating supported Zones. Zone labels are validated for consistency and generated from the source.

`WorldEntities` is a new 16px Entities layer. `AreaSpawn` fields are `entryId` and nullable `runtimeX`/`runtimeY`. `AreaExit` fields are `exitId`, nullable EntityRef `targetEntry`, `blocked`, nullable `futureDestinationLabel`, and nullable `runtimeX`/`runtimeY`. The EntityRef identifies the destination spawn, Level and layer; target Area/entry IDs are derived during import. A blocked future exit can have no target; an unblocked exit must reference an existing AreaSpawn. Stable entry IDs include `default` and `from-<areaId>`.

Farm/Town explicitly retain their approved runtime dimensions through the user-authorized temporary bridge. Their spawn/exit runtime overrides use established arrival/road approach coordinates. Their locked artwork, registered colliders, building interactions, exterior return spawns, movement, speed and camera routines are unchanged. Their topology IntGrid is never stretched into runtime geometry. Existing interior return points remain in the established scene contracts. Other Areas initially use Level pixel dimensions and their authored IntGrid at native scale; rough-area player radius is 5 and speed 80, while existing Farm/Town values remain unchanged.

No terrain cells, world positions or existing Level identifiers were changed. New entry/exit markers were placed on reachable existing corridors. Path 5 has `future-route`, blocked with no target, showing “Route under construction.” No Verdara Highlands or Glass Fields Area exists.

## Import and validation

`scripts/world-import.ts` parses the checked-in project into typed `shared/world/generatedWorld.ts`. This is generated topology, never an independent handwritten map. Its build version is the first 16 characters of the source SHA-256.

Run `npm run world:validate` to check stable IDs, authored Zone membership/labels, dimensions, entry uniqueness/defaults, exit uniqueness, exact EntityRef destination/layer/Level validity, IntGrid shape/values, Travel IDs and the Path 1 → Cross Path Zone boundary. `npm run world:generate` validates and regenerates. All Vite build modes and `npm run dev` run generation first. Do not edit generated data. The authored project was also validated against the official LDtk 1.5.3 JSON schema; its editor-internal field values are populated so reopening/saving preserves the fields and EntityRefs.

Add an Area by creating its Level, filling identity/Zone/type/label fields, authoring a default spawn and exits with EntityRefs, then validating/building. Add a Zone by extending the LDtk `zoneId` field's anchored validation pattern and assigning its consistent display name on new Levels; no importer/scene redesign is required. Keep the mandatory V1 Starting Zone boundary intact. Open a future connection by creating the real destination Level/spawn, pointing `targetEntry` at it, clearing `blocked`, and validating. Do not add fictitious destinations just to satisfy a blocked exit.

## Authority, persistence and delivery

`server/world/WorldService.ts` owns location projection and exit resolution. Authenticated `GET/POST /api/v1/me/world` is staging/test only. Commands accept exactly version, exit ID, expected revision and command UUID; destination, player identity and coordinates are never accepted from the client. Current Area and exit relationship, blocked state and target spawn are checked against generated LDtk data.

The existing `player_grower_events` table stores `world-foundation-location-v1` checkpoint payloads. The existing onboarding owner row serializes transitions with `FOR UPDATE`, without changing XP, currency, initialization or gameplay state. Each committed transition advances a revision; repeated command UUIDs return current state, and reuse with different input/stale requests reject. No migration, grants, new infrastructure or gameplay state dual-write is introduced. Event payloads store Area/runtime identity, Zone, entry position, discovered Area IDs and discovered Travel destination IDs. Invalid/removed content safely restores Starting Spawn at its default entry, retaining the revision fence. Continuous live movement positions are not persisted; restoration uses the last authored entry checkpoint.

Movement remains local presentation as in the established scenes. This milestone authorizes topology transitions; it does not introduce a server movement/proximity simulation or prove that a hostile client physically walked each route. Gameplay/economy authority is unchanged.

Static Farm template is `player-farm`; runtime identity retains `farm-<opaque public profile UUID>`, matching existing private chat admission. The server derives the owner public ID from the authenticated player profile. Farms remain isolated; visiting/remote Farm rendering is not added. Town retains runtime alias `town`, existing automatic Layers and remote renderer. New Areas use their stable Area IDs.

`WorldLocationProvider` lives above the existing SocialProvider; `/world` owns the staging foundation. Staging `/play` and `/town` now redirect to `/world` and restore the server checkpoint; their legacy page implementations are excluded from the staging build. Production/development legacy routes remain gated to their existing implementation until a separately approved foundation rollout. The session/HUD/providers stay mounted across transitions. One active Phaser Area loads at a time; only renderer resources change. Farm/Town use their existing scene factories with an optional exit adapter; rough Areas use `LdtkAreaScene` and the existing NavigationMap/NavigationController. Arrival guards prevent bounce-back/double-trigger; pending transitions suspend movement, and failures restore input without resetting the scene. Farm interiors retain route-based return context to `/world`; Town commerce keeps feature overlays.

Local chat uses the actual runtime Area identity; World uses the authored Zone; Town checks Town membership. The existing AreaConnection/AreaPresence/ChatDirectory transport is retained. Socket replacement occurs when actual Area/entry scope changes, not for HUD/relationship/feature updates. Foundation realtime admission verifies the persisted Area/entry before issuing tickets; production refuses foundation admission. Legacy Farm/Town admission remains compatible. Existing Mail/Friends/DM behavior is unchanged.

Discovery records only reached Areas and configured Travel destinations (currently Farm/Town). No global Area unlock or Travel teleport UI is added. Compact location data appears through the existing status surface and Dev Tools World diagnostics; the one-row HUD is unchanged. Production Dev Tools and the foundation route/API remain unavailable.

## Verification and release

Focused importer/domain tests cover identity, dimensions, malformed data, destination/spawn resolution, blocked future routes, discovery, private Farm/Zone/Town scopes, reachable authored corridors and double-trigger guards. Disposable PostgreSQL tests exercise real authenticated API/client persistence, concurrent replay, stale/fabricated requests, owner isolation, unchanged onboarding values and removed-Area fallback. `test:world:browser` uses actual Phaser scenes/Arcade stepping and a server exit resolver: 14 physical transitions, spawn/camera dimensions, retained React HUD fixture, blocked future exit and mobile camera visibility. This is local staged-mode automation, not authenticated live staging acceptance.

Live staging database/role and required event read/insert, onboarding lock and profile read permissions passed an independent read-only Hyperdrive check. Build/lint/Worker types, official LDtk schema, chat, navigation, multiplayer client, menu/HUD lifetime, Dev Tools production gate, Worker/client and realtime regression checks passed. Existing large-bundle and pg concurrent-query deprecation warnings remain.

Release status and exact file inventory are recorded below after deployment. No production deployment, commit or push is authorized by this milestone's implementation instruction. Baseline HEAD is `1de841bbec1dbe8f1a6f797c12e8ede43c86389a`, synchronized with origin/main before edits. The pre-existing archive, Garden sale audit and benchmark report are preserved and excluded.

Live acceptance checklist: open `https://dev.cactigrow.com/world` through Access; walk Starting Spawn → Path 1 → Cross Path; confirm Starting Zone → First Basin; visit Farm through Cross Path and Town through Path 2; enter/return from a Farm building; visit Path 3/Path 4/wilderness; confirm blocked Path 5 message, input restoration, no page reload, unchanged mobile one-row HUD, camera/player visibility, reopen checkpoint, Local isolation between two Farms, World isolation across the two Zones, same-Area Local delivery, Town multiplayer/Town chat and cross-Area DM. No connected authenticated browser was available for this live acceptance. Physical iPhone/Safari acceptance remains manual.

Deferred: full tutorial, final art, future expansions, Farm visitors, discovery-based Travel UI, continuous movement checkpoints, authoritative movement/proximity enforcement and production promotion after live staging acceptance.

## Final 20-item report

1. **LDtk project:** `world/cactigrow-world.ldtk`; generated source version `0111c5a27d17a26b`.
2. **Actual Levels:** all 11 identifiers are listed in the mapping table above, including the actual `Starting_Spawn_Tutorial_1` suffix.
3. **Zones:** Starting Spawn/Path 1 are `starting-zone`; the other nine Areas are `first-basin`.
4. **Areas:** one stable Area per actual Level; full identifiers, types and topology/runtime dimensions are in the table above.
5. **Authored fields/entities:** eight Level custom fields, `WorldEntities` layer, `AreaSpawn` and `AreaExit`, with explicit paired runtime dimensions/coordinates and EntityRef destinations as documented above.
6. **Import/runtime:** build-time validation/generation, typed shared projections, existing Farm/Town renderers plus a native rough Area renderer; no independent handwritten topology.
7. **Transitions:** local exit arrival guard requests one server command, suspends movement while pending, loads the resolved Area/entry and restores input; HUD/session remain mounted. Farm interior exterior-return state is fenced to its location revision so it cannot override a later LDtk arrival.
8. **Authorization:** authenticated owner identity, current persisted Area, revision, authored exit/relationship, blocked state and command replay checks; no client destination/owner/position input. Server movement/proximity simulation is deferred.
9. **Farms:** shared static template, private runtime `farm-<public profile UUID>` derived on the server; locked geometry retained.
10. **Chat:** Local = runtime Area, World = authored Zone, Town = existing Town membership; existing transport and Town Layers retained. Foundation admission checks persisted location.
11. **Discovery/Travel:** persisted reached Area IDs and reached configured Travel IDs; no blanket unlock, Travel redesign or teleport UI.
12. **Path 5:** future exit rejects with `Route under construction.` without changing location/discovery; no fake destination Area.
13. **Tests/results:** world 9/9 with real disposable PostgreSQL and no skips; Phaser browser 1/1 with 14 transitions, blocked route, no exceptions and 390 x 844 mobile camera visibility. Production/staging builds, lint, Worker types, official LDtk schema, dry-run and relevant existing regressions passed. No authenticated live staging/physical-device claim is made.
14. **Staging Worker:** `5ec7998c-60c6-4c6c-a306-ba9a8839a21e`, deployed through the guarded staging wrapper to `dev.cactigrow.com`, superseding initial foundation version `7b2a87b8-7fec-44f7-92aa-905d08d5d9a2`. Existing isolated Hyperdrive, realtime namespace and Access configuration retained.
15. **Staging transitions:** actual local staging-mode Phaser automation passed Starting Spawn -> Path 1 -> Cross Path, Farm/return, Path 2/Town, Cave/Path 4/wilderness and blocked Path 5. Live staging acceptance remains manual. Anonymous `/`, `/world`, health and protected API probes return 302 to Access; this verifies protection only.
16. **Production:** no deployment or promotion performed; foundation route/API are disabled in production builds/environment.
17. **Files:** complete implementation/documentation inventory below; pre-existing unrelated files remain excluded.
18. **Commit:** no new commit. Baseline HEAD `1de841bbec1dbe8f1a6f797c12e8ede43c86389a`; work remains uncommitted.
19. **Push:** not performed or requested.
20. **Deferred:** tutorial, final terrain art, future Zones, Farm visitors, full Travel UI, continuous movement persistence, movement/proximity enforcement, live multi-account/mobile acceptance and production promotion.

## Changed file inventory

- Source/import: `world/cactigrow-world.ldtk`, `scripts/world-import.ts`, `package.json`.
- Shared topology: `shared/world/types.ts`, `shared/world/world.ts`, `shared/world/generatedWorld.ts`, `shared/world/world.test.ts`.
- Server: `server/world/WorldService.ts`, `server/world/world.integration.test.mjs`, `server/api/router.ts`, `server/realtime/admissionRoutes.ts`.
- Shared social integration: `shared/api/realtimeCredentialsV1.ts`, `shared/realtime/areas.ts`, `shared/realtime/chatLocation.ts`.
- Client/session/API: `src/app/AppRouter.tsx`, `src/app/GameSession.tsx`, `src/app/farmReturnNavigation.ts`, `src/features/social/SocialContext.tsx`, `src/services/api/CactiGrowApiClient.ts`.
- World presentation: `src/game-world/WorldLocationContext.ts`, `src/game-world/WorldLocationProvider.tsx`, `src/game-world/LdtkWorldPage.tsx`, `src/game-world/LdtkAreaScene.ts`, `src/game-world/createLdtkWorldGame.ts`, `src/game-world/AreaExitController.ts`, `src/game-world/FarmTestScene.ts`, `src/game-world/TownTestScene.ts`, `src/game-world/createFarmWorldGame.ts`, `src/game-world/createTownWorldGame.ts`, `src/game-world/farmWorldLayout.ts`.
- Diagnostics/regressions: `src/features/devtools/DevToolsPanel.tsx`, `src/game-world/world.browser.test.mjs`, `src/features/menu/gameMenu.runtime.test.ts`, `server/realtime/areas.test.ts`, `server/realtime/realtimeAdmissionV1.test.ts`.
- Documentation: `PROJECT_CONTEXT.md`, `docs/LDTK_WORLD_FOUNDATION_V1.md`.

Excluded and preserved: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, `local-ai-benchmark-report.txt`. Temporary probe/build/browser evidence is ignored under `.wrangler`; no credentials are included in source or documentation.

## Transition correction - 2026-10-06

The initial foundation left `/play` and `/town` mounted on `FarmWorldPage`/`TownWorldPage`. Their actual `ENTER_LOCATION` handlers navigated directly to `/town` and `/play` with legacy arrival state, bypassing the already-correct LDtk graph/server exit resolver. The live Chrome Farm tab was on `/play`; the live Brave Town tab was on `/town`. Staging now redirects both aliases (and chained `/farm`/`/world-preview` aliases) to `/world`, preserving URL options while restoring the server location rather than interpreting a URL as a teleport. The staging bundle excludes both legacy page implementations. They remain gated to the existing production/development baseline until a separate foundation rollout; no production deployment occurred.

The locked Farm/Town road interaction IDs remain renderer compatibility ports. `authoredRoadExit` reads their single authored exit directly from generated LDtk, fails on ambiguous/missing roads, and supplies the actual exit ID and destination display label. No second transition table or center-spawn fallback is introduced. The server's existing exact exit/spawn resolution is unchanged.

| Direction | Authored exit | Target entry | Runtime position |
|---|---|---|---|
| Player Farm -> Cross Path | to-cross-path-1 | from-player-farm | 128, 24 |
| Cross Path -> Player Farm | to-player-farm | from-cross-path-1 | 1500, 1660 |
| Town -> Path 2 | to-path-2 | from-town-p1 | 456, 24 |
| Path 2 -> Town | to-town-p1 | from-path-2 | 1100, 1280 |

Live Farm re-entry also demonstrated a stale scene projection listener: full Phaser game destruction emits `DESTROY`, while the old subscription cleaned up only on `SHUTDOWN`. A departed Farm could receive the returning Garden projection and call graphics creation after its factory was destroyed. Farm/Town projection subscriptions and diagnostic handles now clean up on either event. Existing registered geometry, camera, interactions, route planner, runtime dimensions and owner isolation are unchanged. The browser regression includes an occupied Garden bed and repeated Farm/Town return loops.

Correction files: `src/app/AppRouter.tsx`, `shared/world/world.ts`, `src/game-world/LdtkWorldPage.tsx`, `src/game-world/FarmTestScene.ts`, `src/game-world/TownTestScene.ts`, `shared/world/world.test.ts`, `server/world/world.integration.test.mjs`, new `src/app/worldRouting.runtime.test.mjs`, `src/game-world/world.browser.test.mjs`, `package.json`, this document and `PROJECT_CONTEXT.md`. Existing uncommitted foundation work and unrelated excluded files are preserved.

Validation: world 11/11 including real PostgreSQL, exact four-direction entries, no direct Farm/Town graph edge, fabricated shortcuts rejected in both directions without moving the player, Local scope changes and retained First Basin World scope, renamed authored road selection and actual staging/production router gates. Navigation 12/12, chat 12/12, menu 8/8, Dev Tools 6/6, production/staging builds, lint, Worker types, staging dry-run and diff checks passed. Real Phaser browser test passed 18 transitions, repeated returns with Garden content, camera/spawn bounds, blocked Path 5, retained HUD fixture and mobile visibility without exceptions.

Final guarded staging Worker: `6404732b-467f-46cf-bc14-d1c5753d3e97`, superseding initial correction `d8086600-8045-487d-8b27-0ca833929fa5` and foundation `5ec7998c-60c6-4c6c-a306-ba9a8839a21e`. LDtk source/build hash remains `0111c5a27d17a26b`: no authored geometry or graph change was needed. No migrations/grants/auth/DNS/binding changes, production deployment, commit or push. Baseline HEAD remains `1de841bbec1dbe8f1a6f797c12e8ede43c86389a`, with 0/0 origin divergence.

Live acceptance on the final Worker passed in the authenticated Brave staging session: Player Farm -> Cross Path -> Player Farm; Town -> Path 2 -> Town; and Cross Path -> Path 2. These were physical movement/road interactions, without a URL teleport or developer reset. Entries appeared beside their authored connections. Town World diagnostics confirmed `town-p1`, entry `from-path-2`, position `{x:1100,y:1280}`, only exit `to-path-2` and LDtk build `0111c5a27d17a26b`. Town World chat showed The First Basin and connected status; no chat messages were sent. Local/World transition scope assertions passed automatically, but two-account delivery and physical-device acceptance were not performed. Proof screenshot: ignored `.wrangler/world-work/live-town-path2.png`.

Chrome acceptance remains blocked: the existing Farm tab and a fresh staging tab failed to fetch dynamically imported `LdtkWorldPage-BYxPf4U_.js`, leaving `/world` blank despite reloads. The same final module and transitions worked in Brave. The cause of this browser-specific asset-loading failure is unresolved; cross-browser staging acceptance is incomplete. Production promotion remains withheld. Earlier foundation report items above describe the prior checkpoint; this correction section supersedes their routing, Worker, test-count and live-acceptance status.

## Gameplay integration polish - 2026-10-06

This section supersedes earlier placeholder rendering, fit-to-Level camera, deferred Travel and spawn-coordinate descriptions. Topology, Level rectangles, IntGrid, locked Farm/Town geometry and private Farm ownership are unchanged.

The rough scene created a standalone 5px circle. All local scenes now call `createPlayerCharacter`, extracted with identical registration from the actual existing Farm/Town body/head silhouette. This reuses the current character visual rather than introducing sprite artwork. Existing Town remote rendering and facing transport are unchanged; the local visual has no directional animation. Rough physics/navigation retain radius 5 and speed 80 for native corridors; Farm/Town retain radius 27 and speed 245. Only explicit staging `?worldDebug` adds the player-body circle and in-world exit labels. Normal gameplay retains the small Zone/Area indicator and blocked-route message.

Camera root cause: the rough scene used `max(viewportWidth/areaWidth, viewportHeight/areaHeight, 1)` on create/resize, enlarging small Levels and changing perceived character scale on each transition. Foundation scenes now share the established viewport-based starting scale (shortest side / 720, bounded 0.72-1.18), follow, authored bounds, resize cleanup and explicit user zoom state across Area changes. The legacy Farm/Town camera remains unchanged. Phaser clamps smaller-than-viewport bounds to the upper-left; foundation camera clamps center spare space independently on each axis without changing zoom or authored bounds. No per-Area camera table exists.

Travel disappeared because the foundation page never mounted the existing `WorldNav` HUD portal. It now does, including an empty discovery explanation. Mobile order remains Logo, Chat, Currency, Player Card, Backpack, Travel, Menu in one row. The header treats `/world` as a physical world for its existing chat dock. Inside Farm, actual Home, Nursery, Garden, Genetics Lab, Mailbox and authored Road to Cross Path projections preserve existing routes/return context. Discovered other major destinations may also appear. Outside Farm, only discovered authored Travel Areas other than the current Area appear. Paths/caves do not unlock merely by existing.

LDtk uses existing nullable `travelDestinationId`, plus nullable `travelSpawnId` (an exact AreaSpawn entryId) and optional `travelDisplayName` (otherwise Area displayName). Farm uses `player-farm` / Farm / `from-cross-path-1`; Town uses `town-p1` / Town / `from-path-2`. Other Levels have null metadata. The importer validates unique destinations and exact spawn existence. Future major Areas can opt in through these fields without a TypeScript destination list.

The authenticated world API accepts either an exact exit command or an exact Travel destination command, never discovery, coordinates or owner identity. Travel requires persisted Area and Travel discovery, rejects current/unknown/unvisited destinations, uses the authored spawn and authenticated own Farm public identity, preserves discovery, and shares existing revision/idempotency/owner-row transaction locks. Only physical graph exits add discovery. Existing event checkpoints persist across refresh/relogin; restoration resolves current authored entry coordinates so later LDtk edits take effect without pixel patches or rewriting player records. No migrations or grants. Server movement/proximity enforcement remains deferred; current Area/graph validation is unchanged.

World tests pass 14/14 including authenticated client/Worker/disposable PostgreSQL, Travel discovery/ownership/replay/relogin/authoring restoration, importer, physical roads and actual HUD/Travel/Farm interior routing. Navigation 12/12, chat 12/12, menu 8/8, builds, lint, Worker types, official LDtk JSON schema, dry-run and diff checks pass. Actual Phaser coverage walks 26 transitions, repeated Farm/Town returns, Cave, First Basin and return to Starting Spawn; it verifies matching character/zoom/bounds, no normal debug labels, explicit debug overlay, blocked Path 5 and actual one-row HUD at 320/360/390px. Final live acceptance and Worker follow below.

Polish files: `world/cactigrow-world.ldtk`, `scripts/world-import.ts`, `shared/world/types.ts`, `shared/world/world.ts`, `shared/world/generatedWorld.ts`, `shared/world/world.test.ts`, `server/world/WorldService.ts`, `server/world/world.integration.test.mjs`, `server/api/router.ts`, `src/services/api/CactiGrowApiClient.ts`, `src/game-world/WorldLocationContext.ts`, `src/game-world/WorldLocationProvider.tsx`, `src/game-world/LdtkWorldPage.tsx`, `src/game-world/LdtkAreaScene.ts`, `src/game-world/AreaExitController.ts`, new `src/game-world/PlayerCharacter.ts`, new `src/game-world/gameplayCamera.ts`, `src/game-world/FarmTestScene.ts`, `src/game-world/TownTestScene.ts`, `src/components/layout/GameHeader.tsx`, `src/components/layout/WorldNav.tsx`, new `src/game-world/worldTravel.runtime.test.mjs`, `src/game-world/world.browser.test.mjs`, `package.json`, this document and `PROJECT_CONTEXT.md`. The preceding foundation inventory remains part of the combined milestone; unrelated archive, Garden sale audit and benchmark report remain excluded.

### Final authored spawn coordinates

Some top/left rough-area entries moved inward for the shared character. Farm/Town entries and Path 5 entries are unchanged; Path 5 retains arrival-guard clearance from its blocked exit. Every rough entry/exit remains reachable in the existing route planner. Edit entity pixels in LDtk for native Areas; edit runtimeX/runtimeY for Farm/Town compatibility entries.

| Level | Entry ID | Runtime x | Runtime y |
|---|---|---:|---:|
| Player_Farm | default | 1500 | 1500 |
| Player_Farm | from-cross-path-1 | 1500 | 1660 |
| Cross_Path_1 | default | 128 | 128 |
| Cross_Path_1 | from-path-1 | 40 | 128 |
| Cross_Path_1 | from-player-farm | 128 | 88 |
| Cross_Path_1 | from-path-2 | 232 | 128 |
| Cross_Path_1 | from-path-3 | 128 | 232 |
| Path_1 | default | 256 | 128 |
| Path_1 | from-starting-spawn-tutorial | 40 | 88 |
| Path_1 | from-cross-path-1 | 488 | 128 |
| Path_3 | default | 128 | 240 |
| Path_3 | from-cross-path-1 | 128 | 88 |
| Path_3 | from-basin-cave | 40 | 368 |
| Path_3 | from-path-4 | 184 | 312 |
| Path_3 | from-path-5-under-construction | 128 | 456 |
| Starting_Spawn_Tutorial_1 | default | 336 | 176 |
| Starting_Spawn_Tutorial_1 | from-path-1 | 648 | 176 |
| Path_2 | default | 256 | 168 |
| Path_2 | from-cross-path-1 | 40 | 104 |
| Path_2 | from-town-p1 | 456 | 88 |
| Town_p1 | default | 1100 | 1280 |
| Town_p1 | from-path-2 | 1100 | 1280 |
| Basin_Cave | default | 360 | 192 |
| Basin_Cave | from-path-3 | 408 | 280 |
| Path_4 | default | 304 | 104 |
| Path_4 | from-path-3 | 40 | 200 |
| Path_4 | from-the-first-basin | 584 | 192 |
| Path_5_Under_Construction | default | 128 | 64 |
| Path_5_Under_Construction | from-path-3 | 128 | 24 |
| The_First_Basin | default | 80 | 400 |
| The_First_Basin | from-path-4 | 40 | 416 |


### Final staging release and acceptance report

Guarded staging Worker **2ee09c19-e56f-4528-9cdd-c2b5a8b7a4ca** is deployed at 100 percent, superseding intermediate polish **4090f590-faf9-4762-9973-a05840c7ddd2**. Source hash is **5eb85aba5d2ce702**. Existing isolated Hyperdrive role/permissions were verified read-only before deployment. No production deployment, schema/grant/data maintenance, Access/DNS/binding change or dependency addition occurred.

1. **Placeholder cause:** `LdtkAreaScene` constructed a standalone circle instead of using the existing Farm/Town visual.
2. **Character fix:** shared `PlayerCharacter.ts` reproduces the actual registered local body/head silhouette exactly; all local physical Areas consume it. Native navigation bodies/speeds and existing Town remote/facing behavior are retained. The established local visual has no directional animation.
3. **Spawns:** nine conservative top/left rough entry adjustments remain authored in LDtk. The complete final entry ID/coordinate matrix above is authoritative; Farm/Town entries are unchanged. Farm -> Cross uses `from-player-farm` (128,88); Cross -> Farm uses `from-cross-path-1` (1500,1660); Town -> Path 2 uses `from-town-p1` (456,88); Path 2 -> Town uses `from-path-2` (1100,1280).
4. **Travel HUD:** foundation now mounts the existing WorldNav portal, including empty-state explanation; actual mobile HUD one-row order passes at 320/360/390px.
5. **Farm unlock:** physical first visit persists discovery; subsequent Travel resolves the authenticated player's own `farm-<public UUID>` runtime.
6. **Town unlock:** unvisited Town is rejected/absent; physical first visit persists permanent unlock. Available live account already had both discoveries, so fresh-unlock live acceptance remains outstanding; automated authenticated PostgreSQL coverage verifies it.
7. **Farm internal Travel:** actual Home, Nursery, Garden, Genetics Lab, Mailbox and Road to Cross Path destinations retain established routing. Live Nursery/Back to Farm return passed without gameplay mutations.
8. **Outside Farm:** only discovered authored major destinations appear; live Path Travel showed Farm and Town. Paths/Cave/blocked future content are not automatically Travel destinations.
9. **Metadata:** existing nullable destination ID plus nullable authored spawn ID and display name; importer validates configured spawn and destination uniqueness. No duplicated world graph or Travel destination table.
10. **Persistence:** existing server events, owner-row transaction, revision and replay rules remain authoritative. Automated refresh/new-authenticated-client restoration and fabricated-discovery rejection pass. Live checkpoint/discovery restoration passed; live logout/login was not performed.
11. **Camera cause:** rough create/resize zoom depended on Level dimensions through fit-to-Level ratios.
12. **Camera fix:** shared viewport-based gameplay scale, authored camera/world bounds, follow/resize cleanup and explicit zoom state. Small bounds center spare viewport space per axis. No per-Area magic numbers or cumulative zoom.
13. **Repeated transitions:** real Phaser automation passes 26 physical transitions including full Starting Spawn/Farm/Town/Cave/First Basin/back sequence, repeated returns, matching player scale, bounds, HUD and mobile resize. Live Brave traversed all physical Areas with stable apparent character size, including Farm/Cross and Town/Path 2 return loops, Path 3/4/First Basin/back, Cave/back and Starting Spawn return. No page reload occurred during physical walks.
14. **Chat:** existing AreaPresence/Chat V2 transport retained; domain and real DO regressions (12/12) verify Local runtime, private Farm, Town membership and World Zone. Live UI showed Local - Basin Cave, World - The First Basin and World - Starting Zone after boundary traversal. Two-account live delivery remains unverified; no messages were sent.
15. **Worker:** `2ee09c19-e56f-4528-9cdd-c2b5a8b7a4ca`, 100 percent staging deployment.
16. **Live acceptance:** shared character visible across rough Areas, compact location labels, no normal debug labels, Travel destinations/own Farm, Nursery return, both required physical loops, wilderness/Cave routing, blocked Path 5 message and input recovery passed in authenticated Brave. Fresh-account unlock and live relogin remain outstanding; physical-device checks remain manual. Automated first-unlock/relogin/mobile coverage passes.
17. **Chrome:** disconnected during final acceptance; earlier module failure cannot be declared fixed or reproduced on this build. Brave initially received old entry HTML on ordinary reload; a fresh acceptance URL loaded the new module. This observation does not prove a Chrome/cache root cause; no infrastructure changes were made.
18. **Files:** polish inventory above and preceding complete foundation inventory cover the combined milestone. Unrelated archive, Garden sale audit and benchmark report remain preserved/excluded.
19. **Commit/push:** not performed while staging acceptance gaps remain. HEAD/origin remain `1de841bbec1dbe8f1a6f797c12e8ede43c86389a`, divergence 0/0; all milestone work stays reviewable in the working tree.
20. **Before production:** complete outstanding live acceptance, including fresh-account discovery/relogin and available Chrome verification, then commit the combined milestone. Production promotion requires a separate instruction. Continuous authoritative movement/proximity enforcement remains the documented V1 limitation, not claimed as implemented by these transitions.

Normal gameplay debug-label removal is covered in both actual Phaser automation and live Areas. Explicit staging `?worldDebug` is the only page-controlled overlay mode; production cannot enable it through that query. Blocked-route feedback remains exactly **Route under construction.**


## LDtk Area scale normalization - 2026-10-06

This supersedes the earlier native-dimension/native-body rough-Area descriptions and pre-normalization runtime spawn tables. Topology, authored entity pixels, IntGrid, graph, IDs, discovery and Zone membership remain unchanged. Runtime dimensions are explicit for every playable Level.

Root cause: the importer used native footprint coordinates for rough scenes. The shared character was already the Farm/Town size, making those scenes miniature. A second importer shortcut skipped IntGrid whenever runtime dimensions existed, rather than specifically exempting locked Farm/Town templates.

Farm's footprint/runtime ratios are approximately 5.2083 horizontally and 4.5673 vertically; Town's are 5.0926 and 3.6058. Those are independent locked runtime layouts, not scaled copies of their LDtk IntGrid. They remain exceptions: established runtimeX/runtimeY entries and scene-registered collision are retained exactly. The new rough-Area model uses approximately the same horizontal scale while preserving authored aspect ratios: 5x on both axes, with a 4x tutorial. A proposed 3x tutorial failed the actual 27-unit collision-body/5-unit navigation-clearance test at its existing edge entrance; 4x preserves that authored entrance without pixel corrections.

### Runtime dimension inventory

| Level | LDtk footprint | Runtime dimensions | Geometry model |
|---|---|---|---|
| Player_Farm | 576 x 416 | 3000 x 1900 | Locked existing layout |
| Cross_Path_1 | 256 x 256 | 1280 x 1280 | 5x uniform |
| Path_1 | 512 x 256 | 2560 x 1280 | 5x uniform |
| Path_3 | 256 x 480 | 1280 x 2400 | 5x uniform |
| Starting_Spawn_Tutorial_1 | 672 x 352 | 2688 x 1408 | 4x uniform |
| Path_2 | 512 x 256 | 2560 x 1280 | 5x uniform |
| Town_p1 | 432 x 416 | 2200 x 1500 | Locked existing layout |
| Basin_Cave | 432 x 384 | 2160 x 1920 | 5x uniform |
| Path_4 | 608 x 336 | 3040 x 1680 | 5x uniform |
| Path_5_Under_Construction | 256 x 256 | 1280 x 1280 | 5x uniform |
| The_First_Basin | 1184 x 768 | 5920 x 3840 | 5x uniform |

### Coordinate and collision contract

For rough Areas, `topologyToRuntime` maps Level-local authored coordinates after layer offsets:

`runtimeX = (entityX + layerOffsetX) * runtimeWidth / footprintWidth`

`runtimeY = (entityY + layerOffsetY) * runtimeHeight / footprintHeight`

The same transform maps merged IntGrid rectangle centers and sizes, all current authored AreaSpawn/AreaExit entities and bounds. No world-map `worldX/worldY` is added to local gameplay coordinates. Runtime dimensions must preserve rough-Area aspect ratio; missing dimensions or rough per-entity runtime overrides reject import. Farm/Town continue to use their existing explicit runtime overrides and registered collision, never this IntGrid scaling. No new generic entity renderer is introduced; current authored gameplay entities are the spawn/exit points.

The brown background and black collision placeholders consume the generated runtime rectangles directly. Rough physics/navigation now use the existing Farm/Town gameplay radius 27, margin 5 and speed 245 rather than native-template radius 5/speed 80. Character registration/art/scale is unchanged. No movement/pathfinding algorithm changed. All authored rough entries and exits are reachable with the gameplay body. Cross Path spans 1040 units between opposing exits (approximately 4.24 seconds at speed 245); this is a geometric estimate, not a network timing guarantee.

The existing shared viewport-based camera remains unchanged: follows the player, uses runtime bounds, preserves apparent player size and explicit zoom, and never fits the Level. HUD, debug gating, actual blocked-route feedback, Farm ownership, Travel and chat identities remain unchanged. Server checkpoint restoration uses the transformed current authored entry, preserving discovery and revision without rewriting saved records or a database migration.

### Normalized runtime entries

| Level | Entry ID | Runtime x | Runtime y |
|---|---|---:|---:|
| Player_Farm | default | 1500 | 1500 |
| Player_Farm | from-cross-path-1 | 1500 | 1660 |
| Cross_Path_1 | default | 640 | 640 |
| Cross_Path_1 | from-path-1 | 200 | 640 |
| Cross_Path_1 | from-player-farm | 640 | 440 |
| Cross_Path_1 | from-path-2 | 1160 | 640 |
| Cross_Path_1 | from-path-3 | 640 | 1160 |
| Path_1 | default | 1280 | 640 |
| Path_1 | from-starting-spawn-tutorial | 200 | 440 |
| Path_1 | from-cross-path-1 | 2440 | 640 |
| Path_3 | default | 640 | 1200 |
| Path_3 | from-cross-path-1 | 640 | 440 |
| Path_3 | from-basin-cave | 200 | 1840 |
| Path_3 | from-path-4 | 920 | 1560 |
| Path_3 | from-path-5-under-construction | 640 | 2280 |
| Starting_Spawn_Tutorial_1 | default | 1344 | 704 |
| Starting_Spawn_Tutorial_1 | from-path-1 | 2592 | 704 |
| Path_2 | default | 1280 | 840 |
| Path_2 | from-cross-path-1 | 200 | 520 |
| Path_2 | from-town-p1 | 2280 | 440 |
| Town_p1 | default | 1100 | 1280 |
| Town_p1 | from-path-2 | 1100 | 1280 |
| Basin_Cave | default | 1800 | 960 |
| Basin_Cave | from-path-3 | 2040 | 1400 |
| Path_4 | default | 1520 | 520 |
| Path_4 | from-path-3 | 200 | 1000 |
| Path_4 | from-the-first-basin | 2920 | 960 |
| Path_5_Under_Construction | default | 640 | 320 |
| Path_5_Under_Construction | from-path-3 | 640 | 120 |
| The_First_Basin | default | 400 | 2000 |
| The_First_Basin | from-path-4 | 200 | 2080 |


### Normalization validation and release

World 15/15 passes with actual authenticated Worker/client and disposable PostgreSQL, including explicit dimensions, deterministic spawn/exit/collision transforms, unchanged Farm/Town, actual-body route reachability, blocked Path 5, private Farm ownership, discovery restoration and Local/World scopes. Actual Phaser automation passes all 26 repeated physical transitions at the normalized scale: camera/world bounds equal runtime dimensions, zoom remains 1.18 on desktop and 0.72 after mobile resize, body radius stays 27, character remains unscaled with identical 34-unit body/40-unit head, normal debug labels remain absent, blocked route works and actual mobile HUD stays one row. No browser exceptions.

Navigation 12/12 and Chat 12/12 pass; production/staging builds, lint, Worker TypeScript, official LDtk schema, guarded staging dry-run and diff checks pass. Direct JSON comparison against the pre-normalization source verifies entire Farm/Town Levels unchanged, and all other topology dimensions/world positions/IntGrid/entity positions/graph fields unchanged. Only non-template runtime dimension fields/editor values changed. No dependencies or migrations.

Guarded staging Worker **fb4b03cd-5aed-47e0-bf32-d7cc2a7250c4** is deployed at **100 percent**, superseding **2ee09c19-e56f-4528-9cdd-c2b5a8b7a4ca**. Source hash **f9c34640397b7f42**, entry `index-CjG2ntBd.js`, Area module `LdtkWorldPage--7HrSnqo.js`. Current read-only preflight verified `cactigrow_staging` / `cactigrow_staging_runtime` and unchanged event/owner-lock/profile permissions. Existing Access, bindings and data remain intact.

Changed for this correction: `world/cactigrow-world.ldtk`, `scripts/world-import.ts`, generated `shared/world/generatedWorld.ts`, `src/game-world/LdtkAreaScene.ts`, `shared/world/world.test.ts`, `src/game-world/world.browser.test.mjs`, this document and `PROJECT_CONTEXT.md`. Pre-existing uncommitted foundation/polish work remains intact; unrelated archive, Garden audit and benchmark report remain excluded.


### Normalization final 12-item report

1. **Root cause:** raw compact footprint pixels drove rough runtime geometry; runtime-dimension collision skipping was incorrectly broader than the locked-template exception.
2. **Scaling model:** explicit LDtk runtime dimensions; uniform 5x for roads/junction/cave/basin and 4x for tutorial. Locked Farm/Town use their established independent runtime layouts.
3. **Runtime dimensions:** complete inventory above, including unchanged Farm/Town; no topology Level resize.
4. **Transform:** one deterministic Level-local ratio transform after layer offsets; rough aspect ratio enforced.
5. **Spawns/exits:** all current authored entity points transformed on import; IDs, EntityRefs and physical graph retained. Farm/Town runtime overrides unchanged. Normalized entry matrix above supersedes earlier runtime coordinates.
6. **Collision:** merged IntGrid rectangle center and dimensions transformed together; locked Farm/Town registered collision remains excluded from IntGrid import.
7. **Camera:** existing gameplay scale/follow/resize remains unchanged; generated runtime dimensions feed camera/world bounds, never fit-to-Level zoom.
8. **Farm/Town:** complete LDtk Level equality verified against pre-change source; artwork, runtime geometry, buildings, entry overrides, body/speed, ownership and existing camera behavior untouched by this correction.
9. **Staging Worker:** `fb4b03cd-5aed-47e0-bf32-d7cc2a7250c4`, 100 percent, world hash `f9c34640397b7f42`.
10. **Visual acceptance:** authenticated live staging walk passed in Brave for Starting Spawn, Cross Path, Path 3, Basin Cave and The First Basin on the normalized build. Physical Path 3/Cave return and Path 4/Basin entry also passed. Character size stayed constant while the camera followed across the expanded geometry; no giant Area labels appeared. This is observed staging evidence, not fresh-account/relogin or separate Chrome acceptance for the prior polish milestone.
11. **Tests:** 15 world, 26 actual Phaser transitions, 12 navigation and 12 chat tests; production/staging builds, lint, Worker types, official schema, dry-run and diff checks pass.
12. **Commit/push:** no commit/push or production deployment. Combined milestone still awaits the prior live acceptance gate; this task does not waive it. Unrelated user files are preserved.

### Live normalization visual evidence

Authenticated Staging Tester on `dev.cactigrow.com/world?acceptance=scale-fb4b03` completed the five required visual checks. Starting Spawn was restored to its transformed authored entrance. Cross Path was entered physically from the unchanged Farm, then crossed to Path 3; the junction took multiple seconds to walk. Path 3 was walked down to Basin Cave, and the Cave interior and return connection were checked. Path 4 was traversed in multiple camera-following segments to the authored First Basin entrance; Basin interior movement confirmed that the larger Area extends beyond the viewport. Character registration and gameplay camera zoom stayed consistent, with the small location indicator and no giant debug labels. Automated traversal covers all graph connections and blocked Path 5; live visual evidence here is limited to the observed routes.

Local evidence (ignored, not committed): `.wrangler/world-work/scale-starting.png`, `scale-cross-path.png`, `scale-path3.png`, `scale-cave.png`, `scale-first-basin-entry.png`, and `scale-first-basin.png`. The normalization visual checks are complete; prior combined-milestone fresh-account unlock/relogin and separate live Chrome acceptance remain unclaimed. No production deployment or commit/push.

## Area naming and full-width outdoor exits - 2026-10-06

The Area display name is now **The Basin**; its persisted stable ID `the-first-basin` and Level identifier `The_First_Basin` are retained. Zone `first-basin` / **The First Basin** is unchanged. Existing checkpoint/discovery/EntityRef/chat identities remain valid without a migration, alias or manual saved-state rewrite.

`AreaExit` is now an LDtk rectangle with resizable X/Y and fixed centered pivot `(0.5, 0.5)`. Its native width/height and position, including layer offsets, use the same topology-to-runtime transform as terrain. New nullable integer `runtimeWidth`/`runtimeHeight` entity fields are reserved for the locked Farm/Town compatibility bridge; rough Areas cannot override the transform. The importer validates positive sizes, centered pivots and runtime bounds. No TypeScript opening table is added.

All 21 authored rectangles span their usable terrain opening, including Path 3's east branch (moved from an interior point to the actual opening), tutorial's east opening, and blocked Path 5. Farm/Town rectangles cover the existing 246-unit gap between the unchanged road posts. Their established spawn points, dimensions, art, colliders, internal buildings/interactions, movement and owner isolation remain unchanged. Rough entry points are authored separately, inside the destination and outside return triggers.

`AreaExitController` tests player-center containment, with 8 units of rearm hysteresis. A trigger starts disarmed until the player is outside its bounds; entry consumes its armed state once. Pending transitions suspend scene movement/exit checks and the existing provider busy guard suppresses concurrent commands. Successful arrivals cannot bounce; failed or blocked exits remain disarmed until the player walks away. There is no added delay. The unchanged server accepts only exit ID/revision/command ID, validates current Area, authored connection/blocked/target spawn, and preserves transaction/replay authority. Server movement/proximity enforcement remains deferred, as before.

Staging Farm/Town road interaction targets/prompts and direct semantic-intent transitions are retired; road visuals/colliders remain, and internal doors keep their existing behavior. Farm HUD Travel retains internal buildings and discovered major destinations, omitting the physical road shortcut. Normal scenes draw no exit dots/rectangles/debug labels. Explicit staging `?worldDebug` draws bounds, exit ID, destination Area/entry/coordinates and local spawn-point markers. Blocked overlap requests the server once and shows **Route under construction.**; standing in it does not repeat requests.

### Authored runtime triggers (center and size)

| Area | Exit | Runtime center | Runtime size |
|---|---|---|---|
| player-farm | to-cross-path-1 | 1500, 1790 | 246 x 118 |
| cross-path-1 | to-path-1 | 120, 440 | 240 x 560 |
| cross-path-1 | to-player-farm | 640, 120 | 320 x 240 |
| cross-path-1 | to-path-2 | 1160, 560 | 240 x 320 |
| cross-path-1 | to-path-3 | 640, 1160 | 320 x 240 |
| path-1 | to-starting-spawn-tutorial | 120, 320 | 240 x 480 |
| path-1 | to-cross-path-1 | 2440, 680 | 240 x 720 |
| path-3 | to-cross-path-1 | 640, 120 | 320 x 240 |
| path-3 | to-basin-cave | 120, 1920 | 240 x 320 |
| path-3 | to-path-4 | 1160, 1840 | 240 x 320 |
| path-3 | to-path-5-under-construction | 640, 2280 | 320 x 240 |
| starting-spawn-tutorial | to-path-1 | 2592, 448 | 192 x 384 |
| path-2 | to-cross-path-1 | 120, 520 | 240 x 400 |
| path-2 | to-town-p1 | 2280, 120 | 320 x 240 |
| town-p1 | to-path-2 | 1100, 1420 | 246 x 118 |
| basin-cave | to-path-3 | 2040, 1440 | 240 x 320 |
| path-4 | to-path-3 | 120, 1120 | 240 x 320 |
| path-4 | to-the-first-basin | 2920, 880 | 240 x 400 |
| path-5-under-construction | to-path-3 | 640, 120 | 320 x 240 |
| path-5-under-construction | future-route | 640, 520 | 160 x 80 |
| the-first-basin | to-path-4 | 120, 2000 | 240 x 320 |

### Current authored arrival points

This supersedes earlier rough entry coordinate tables; Farm/Town remain unchanged.

| Area | Entry | Runtime point |
|---|---|---|
| player-farm | default | 1500, 1500 |
| player-farm | from-cross-path-1 | 1500, 1660 |
| cross-path-1 | default | 640, 640 |
| cross-path-1 | from-path-1 | 360, 440 |
| cross-path-1 | from-player-farm | 640, 440 |
| cross-path-1 | from-path-2 | 920, 560 |
| cross-path-1 | from-path-3 | 640, 920 |
| path-1 | default | 1280, 640 |
| path-1 | from-starting-spawn-tutorial | 360, 320 |
| path-1 | from-cross-path-1 | 2200, 680 |
| path-3 | default | 640, 1200 |
| path-3 | from-cross-path-1 | 640, 440 |
| path-3 | from-basin-cave | 360, 1920 |
| path-3 | from-path-4 | 920, 1840 |
| path-3 | from-path-5-under-construction | 640, 2040 |
| starting-spawn-tutorial | default | 1344, 704 |
| starting-spawn-tutorial | from-path-1 | 2400, 448 |
| path-2 | default | 1280, 840 |
| path-2 | from-cross-path-1 | 360, 520 |
| path-2 | from-town-p1 | 2280, 440 |
| town-p1 | default | 1100, 1280 |
| town-p1 | from-path-2 | 1100, 1280 |
| basin-cave | default | 1800, 960 |
| basin-cave | from-path-3 | 1800, 1440 |
| path-4 | default | 1520, 520 |
| path-4 | from-path-3 | 360, 1120 |
| path-4 | from-the-first-basin | 2680, 880 |
| path-5-under-construction | default | 640, 320 |
| path-5-under-construction | from-path-3 | 640, 360 |
| the-first-basin | default | 400, 2000 |
| the-first-basin | from-path-4 | 360, 2000 |

Validation: world 17/17 with actual authenticated Worker/client and disposable PostgreSQL; Phaser browser 1/1 with 26 keyboard crossings on alternating usable lanes, one request per transition, no bounce, blocked overlap no spam, hidden normal markers, explicit debug bounds, character/camera and mobile HUD checks. Navigation 12/12, chat 12/12, production/staging builds, lint, Worker types, official LDtk schema and staging dry-run passed. JSON comparison confirms all topology dimensions/world positions and IntGrid data unchanged. Current read-only Hyperdrive preflight confirmed `cactigrow_staging` / `cactigrow_staging_runtime` with required permissions.

Guarded staging Worker **8a14837a-0d19-4509-9386-b549a61dc9ee** is at **100 percent**, replacing **fb4b03cd-5aed-47e0-bf32-d7cc2a7250c4**. LDtk hash `a4f045dcf0250d71`; entry `index-CU4hbNXG.js`, Area module `LdtkWorldPage-DvA7crGW.js`. Existing bindings, Access, database/schema/grants and production remain unchanged.

Changed for this correction: `world/cactigrow-world.ldtk`, `scripts/world-import.ts`, `shared/world/types.ts`, generated `shared/world/generatedWorld.ts`, `src/game-world/AreaExitController.ts`, `src/game-world/LdtkAreaScene.ts`, `src/game-world/FarmTestScene.ts`, `src/game-world/TownTestScene.ts`, `src/game-world/LdtkWorldPage.tsx`, `shared/world/world.test.ts`, `src/game-world/world.browser.test.mjs`, `src/game-world/worldTravel.runtime.test.mjs`, this document and `PROJECT_CONTEXT.md`. Earlier foundation/polish work and unrelated user archive/audit/benchmark files are preserved. No commit/push.

The final upload also synchronized LDtk's cached entity world coordinates with the authored positions; it supersedes this task's initial Worker `b8031c08-27cd-47fd-88d2-c58bf848f658`. Cloudflare deployment listing confirms final Worker `8a14837a-0d19-4509-9386-b549a61dc9ee` at 100 percent. The authenticated staging page loaded `index-CU4hbNXG.js`.

### Live staging acceptance for this correction

Authenticated Brave acceptance used ordinary ground movement through off-center parts of openings, without an exit button, interaction key, URL teleport or developer reset. Separate actual Phaser automation used held arrow keys for all 26 transitions, demonstrating that exit clicks are unnecessary. The live character/camera size stayed consistent, arrivals stayed inside destinations without visible bounce or a second transition, and normal scenes showed no exit markers or giant Area labels.

| Live route | Result |
|---|---|
| Starting Spawn -> Path 1 -> Starting Spawn | Passed both directions |
| Path 1 -> Cross Path -> Path 1 | Passed both directions |
| Cross Path -> Player Farm -> Cross Path | Passed both directions and additional lanes |
| Cross Path -> Path 2 -> Cross Path | Passed both directions |
| Path 2 -> Town -> Path 2 | Passed both directions |
| Path 3 -> Path 4 -> The Basin -> Path 4 -> Path 3 | Passed; existing Basin checkpoint also restored with the new display name |
| Path 3 -> Path 5; future-route overlap; Path 5 -> Path 3 | Passed; blocked overlap stayed in Path 5 with Route under construction, then normal movement returned to Path 3 |
| Explicit worldDebug, then normal reload | Bounds/IDs/destination entry coordinates/spawn markers visible only in debug mode |

Chat labels changed to Local - Town / World - The First Basin on Town return and Local - Path 1 / World - Starting Zone after crossing the Zone boundary. No chat messages were sent; this does not claim two-account delivery verification. Movement followed existing obstacle-aware routes across the expanded geometry. Proof images are ignored local artifacts under `.wrangler/world-work/`, including `triggers-farm-return.png`, `triggers-starting-return.png` and `triggers-basin-final.png`.

Additional live proof: `triggers-blocked-normal.png` shows the player-facing blocked message without debug text; `triggers-debug.png` shows the explicit overlay. Normal mode was restored afterward. Precise blocked-request suppression is established by the automated request counter, while live acceptance establishes the visible message and unchanged Area. Fresh build and lint checks passed after final LDtk cached-coordinate synchronization.

### Ten-item implementation report

1. **Naming:** wilderness Area now displays The Basin; Zone still displays The First Basin.
2. **Identity:** displayName changed only. Stable Area ID `the-first-basin` / Level `The_First_Basin` retained for existing persisted checkpoints/discovery and graph references.
3. **Architecture:** player-center overlap with LDtk-authored full-opening rectangles automatically requests the exit ID. Outdoor point/radius prompts and staging road intent shortcuts are retired. Internal building doors retain their existing interactions.
4. **Schema:** AreaExit resizable X/Y with centered pivot; dimensions transformed with existing Level runtime geometry. Nullable runtimeWidth/runtimeHeight fields supply locked Farm/Town entity bridge sizes. All 21 triggers are authored in LDtk; importer/generated type/data carry the bounds.
5. **Bounce:** separate inward destination points, initial disarm, consumed overlap, 8-unit leave/rearm hysteresis and pending guard prevent bounce/double requests.
6. **Blocked:** future-route stays in Path 5, reports Route under construction, and remains disarmed while standing inside. Automated request-count assertion passes.
7. **Staging:** Worker `8a14837a-0d19-4509-9386-b549a61dc9ee` at 100 percent; LDtk `a4f045dcf0250d71`. No production deployment, commit or push.
8. **Live:** authenticated route and presentation results are recorded above; keyboard-only crossings and precise request counts are separately proven in actual Phaser automation.
9. **Checks:** world 17/17 (actual Worker/client/PostgreSQL), Phaser 1/1 (26 transitions), navigation/chat 12 each, production/staging builds, lint, Worker types, official LDtk schema, staging dry-run, geometry comparison and diff checks pass.
10. **Before Starting Experience V1:** no new schema/geometry blocker. Previously outstanding fresh-account first-discovery/relogin, separate Chrome and physical-device/two-account acceptance remain unclaimed. Tutorial content and final terrain art remain future work; continuous authoritative movement/proximity enforcement remains the documented limitation. Production promotion requires separate authorization. Combined uncommitted milestone and unrelated user files are preserved.

## Accepted staging development checkpoint - 2026-10-06

The user accepted World Foundation V1 as the staging development baseline and explicitly authorized a checkpoint commit and push of the complete milestone to main. This supersedes earlier commit/push hold statements. The accepted scope includes foundation/scaling, Travel/discovery, shared character rendering, automatic full-opening exits, The Basin display naming, debug gating and all associated documentation/tests. The outstanding checks above remain unclaimed; acceptance does not fabricate their results. Subsequent development remains staging only, with no production deployment authorized. The unrelated production archive, Garden audit and benchmark report are excluded and preserved.
