# First Basin Environment V1

Staging presentation milestone, 2026-10-07, starting from accepted Settlement Art V1, World Foundation V1, Starting Experience V1 and Character/NPC V2.1. Production, persistent gameplay authority, economy, database schema/data administration, deployment configuration and all 117 accepted art files remain unchanged. Human visual acceptance is pending; commit/push is not authorized until that acceptance.

## 1. Master-world asset extensions

One reusable First Basin extension atlas complements the unchanged full Desert Master V1: 1024 x 512, 32 slots of 128 x 128, one-pixel sampling inset. Eight cave floor variants, sixteen connected cave wall masks and eight props cover all seven target Areas. Three original generated masters, exact prompts, numeric frame/foot/display metadata and deterministic packing are saved. All 32 frames are distinct/nonblank; ground/wall frames are opaque, prop frames retain genuine alpha and complete padded silhouettes. SHA256: `9bd1271091e313924d68c8a1c014c665a2416199957e6a3a4de50a3a000f8aba`. No accepted art was repainted or replaced.

## 2. Cross Path result

The accepted sand, broad four-way junction, original rock boundary and old road layers remain saved. A narrower packed route, two small direction markers, a cairn and a cactus group clarify the hub without filling its center. Existing west Path 1, north Farm, east Path 2 and south Path 3 triggers/spawns remain exact. The 1280 x 1280 runtime bounds and 17 physical obstacle rectangles are unchanged.

## 3. Path 2 result

A broader maintained dirt route follows the established winding corridor to Town; sparse grass, shrub, cactus, cairn and rubble connect settled and wilderness materials. All 33 physical obstacles, 2560 x 1280 bounds and Town/Cross openings are preserved. Road authoring follows the existing NavigationMap rather than drawing a shortcut through walls.

## 4. Path 3 result

A narrower canyon trail and sparse roots/mineral debris introduce the remote branch. Its lower fork clearly connects west to Cave, east to Path 4 and south to unfinished Path 5. The 1280 x 2400 bounds, 52 physical obstacles, all four exits and five spawns are unchanged.

## 5. Basin Cave result

Quieter gray-tan dusty stone, darker cave earth and connected stratified sandstone walls distinguish the chamber from bright outdoor sand. Small roots, mineral rubble, a damp ground patch and a wall-grounded weathered stone provide restrained detail. The cave references only the 2 MiB extension for terrain. No lighting, combat, rewards or new cave behavior is introduced. Its 2160 x 1920 bounds and 34 physical obstacles remain exact. The existing cave has one exit back to Path 3; there is no direct Cave-to-Path-4 edge.

## 6. Path 4 result

The existing long rugged corridor opens the sightlines toward The Basin. Sandstone edges, sparse cactus/deadwood, mineral soil pockets and a cairn/rockslide detail share the outdoor master and extension. Runtime 3040 x 1680, 42 obstacle rectangles and both road endpoints remain unchanged.

## 7. The Basin result

The large 5920 x 3840 wilderness retains its authored lobes and 162 merged collision rectangles. Broad quiet sand, subtle regions and a pale dry wash frame a long navigable trail and open space for future content. Decorative density remains low: nine extension props plus sparse reused vegetation across this large Area. No harvesting population, encounters or new interactions are added.

## 8. The Basin landmarks

Five separated visual groups are saved directly in LDtk: entrance cactus grove near (1060,1860), stratified mesa shoulder near (2440,1640), pale wash near (3000,2380), central cairn near (3680,2140) and eastern cactus/rubble ridge near (4860,2500). Tall solid rocks snap to existing blocked terrain; the other groups use floor material and small decoration. These are orientation aids only. Both distant groves, the pillar, cairn and broad wash are checked from actual imported/rendered source tiles.

## 9. Path 5 blocked-route treatment

Connected canyon walls and rockslide debris sit beyond the unchanged blocked trigger (640,520), 160 x 80. The existing derived barrier starts at y560; approach and the north return stay readable. The message is exactly **Route under construction.**, with null destination/entry. Its 1280 x 1280 runtime bounds and 15 collision rectangles are unchanged. No Verdara Highlands, Glass Fields or later Levels are introduced. A read-only alpha check confirms the nearby cairn paints zero pixels over the return opening.

## 10. LDtk changes

Eight new visual definitions normalize to existing Ground/GroundVariation/Paths/Decorations/BoundaryEdges runtime roles. Ground uses 32-pixel authoring cells where dimensions divide exactly; Cave and Path 4 use 16. Overlays use 8, boundaries/props 16. Separate cave/outdoor connected rules use sixteen NESW masks with outside-Level neighbors blocked. Original definitions remain wholly unchanged. All nonvisual Level metadata, IntGrid and entity payloads remain unchanged. Starting Spawn, Path 1, Farm and Town are complete unchanged Level payloads. Saved project passes official LDtk 1.5.3 schema validation; visual authoring and generated world reproduce byte-for-byte. World version: `27890079e12a845f`.

## 11. Collision preservation

IntGrid remains the only rough-Area collision source; decorative layers create no physics. Runtime merged rectangles, registered Arcade bodies, navigation graph nodes/routes, radius27/margin5, character body54 x54/depth120 and camera/world bounds are exact against the pre-art actual scene baseline. All 782 authored blocked-cell centers are covered by visible wall art. Existing disconnected pockets are preserved and rejected by navigation; art does not silently make them playable. Farm/Town registered collision and compact Level footprints are untouched.

## 12. Exit preservation

All 21 world exits and authored entry IDs/coordinates/dimensions remain exact. The dedicated seven-Area browser fixture checks 1,526 walkable points within the existing exit rectangles and 713 border samples. No art closes these openings. World Foundation's real PostgreSQL tests retain stale/fabricated/blocked command rejection, row-lock/revision/receipt behavior, restore and discovery/Travel scope. Continuous server movement/proximity enforcement remains the previously documented deferred work; this presentation task does not implement or claim it.

## 13. Minimap behavior

All seven rough environments render paths/material regions from saved canonical layers, the existing registered obstacle projection, player marker and exit labels. Map clicks/taps use the existing ground-walk port. Valid rapid destinations replace the active route; blocked/disconnected clicks leave an already-valid route intact. Map state remains transient; Area refresh is also checked through the preserved 26-transition world fixture. Farm100 and Town72 merged surface rectangles are exact against their accepted baseline. The isolated scene/minimap fixture records zero API calls; networking source remains unchanged. No persistence or second topology owner is added.

## 14. Mobile result

All 21 automated viewport checks pass at 320/360/390 widths across seven Areas: one-row HUD, visible player, correct map Area and no horizontal overflow, with exit geometry/bounds separately preserved. True touch and map walk/route replacement are exercised; Cave remains readable without screen-darkening layers. Local screenshots include all width/map pairs. Temporary fit-to-Level overview screenshots can include margins; ordinary gameplay camera framing uses the unchanged camera implementation. These are Chrome viewport checks, not physical iPhone acceptance. Accepted character scale/anchors are unchanged.

## 15. Performance impact

New PNG: **918,520 bytes encoded**, **2,097,152 bytes (2 MiB) decoded RGBA8**. Cave uses the extension only; outdoor Areas reuse the 3 MiB desert atlas plus extension (5 MiB source terrain). No Area-specific background textures. Source masters are not runtime assets.

| Area | Terrain images | Derived material cache | Source terrain RGBA |
| --- | ---: | ---: | ---: |
| Cross Path | 358 | 2,603,664 B / 41 textures | 5 MiB |
| Path 2 | 741 | 2,159,136 B / 34 | 5 MiB |
| Path 3 | 711 | 2,159,136 B / 34 | 5 MiB |
| Cave | 996 | 1,206,576 B / 19 | 2 MiB |
| Path 4 | 1369 | 2,603,664 B / 41 | 5 MiB |
| The Basin | 2495 | 2,921,184 B / 46 | 5 MiB |
| Path 5 | 190 | 825,552 B / 13 | 5 MiB |

Actual Chrome uses WebGL. Cache keys and terrain-image counts plateau across walking, map toggles and all viewport changes. Short desktop observations on this 120Hz headless host show approximately 119-121 postrender frames/s and 8.3ms median intervals. These are observations, not a physical mobile-device benchmark. RGBA8 source/cache estimates exclude characters, GPU copies/mipmaps and driver overhead; active shared texture cache lifetime is unchanged. The largest Area's material cache is approximately 2.79MiB. Opaque floor sampling removes the dark grid without adding floor canvases or new per-frame effects.

## 16. Staging Worker

Guarded staging deployment succeeded **2026-10-07 23:13:49 UTC**: `cactigrow-staging`, version `8637cfc1-6a10-4586-a377-691d691ef71c`, deployment `d30b01a8-bdd6-4ca6-befa-e456a34c1c61`, **100% traffic**, https://dev.cactigrow.com. Previous accepted Settlement version: `e93ab988-702d-47e5-87c8-01f77f4933f0`. Authenticated browser loads `/assets/index-DNg4OoEJ.js`. The first attempt failed before upload because the machine's default OAuth login belonged to another project; retry used the existing isolated CactiGrow configuration and preserved the default login. No production deployment or infrastructure/data administration occurred.

## 17. Tests/build/lint

Final meaningful runs: Basin pure/helper13/13; seven-Area actual browser1/1; Settlement pure9/9; World19/19 with real isolated PostgreSQL; Starting29/29 with PostgreSQL and full Chrome flow; full world browser1/1 including26 transitions and960 character poses; Worker42/42. Eleven remaining regression scripts pass159 checks; the twelfth website script has one pass and one unrelated existing failure. Across these final runs: **274 passing test executions, one unchanged website harness failure, zero skips**.

`npm run build`, `build:staging`, `lint`, `check:worker`, Worker type freshness, staging dry-run, schema, baseline preservation, generated-world/authoring reproduction and atlas scratch reproduction pass. Existing large-chunk and `pg` concurrent-query warnings remain. The website Node runner reads `import.meta.env.MODE` through unchanged `farmReturnNavigation.ts`; direct Node provides no Vite environment. Both that source and website test are byte-equal to this milestone baseline; no unrelated routing fix was made. The known World runner idle handle is bounded using `--test-force-exit` for the same four files after their19 actual tests finish, as in the accepted preceding milestone. Test adaptations allow explicitly authorized new visual layers while retaining authority hashes, original full-world transitions and all960 character poses.

## 18. Visual acceptance status

Automated final seven-Area acceptance and manual source/scene review are complete. Dark floor grids caught during review are resolved in the isolated Basin helper; faint repeated road texture lines remain a minor human-review item. Human visual acceptance and physical-device acceptance remain pending.

Authenticated live walkthrough is complete in Chrome at staging. The complete Cross Path -> Path 2 -> Town -> Path 2 -> Cross Path round trip is verified, followed by Cross Path -> Path 3 -> Basin Cave -> Path 3 -> Path 4 -> The Basin -> Path 4 -> Path 3 -> Path 5 -> Path 3 -> Cross Path. Every leg uses ordinary minimap walking and automatic authored transitions. Player, HUD and map Area labels refresh correctly; a new clear-ground destination replaces the earlier route and moves the character normally. Local chat labels were checked in Path 2, Path 3, Basin Cave, The Basin and Cross Path; World reads The First Basin. No chat messages were sent. Cave materials, player scale and the sole return opening are readable in a live 390-pixel viewport. The Basin's live normal-viewport view shows the entrance grove and broad open space. Approaching Path 5's rockslide displays exactly **Route under construction.** and leaves the player in Path 5; its north return succeeds and clears that message. All seven target Areas were visited. The character finishes at Cross Path's unchanged from-Path-3 spawn (640,920), with the normal viewport restored and chat closed.

Movement in this live browser was heavily throttled while the local browser fixtures ran normally; no gameplay, timing or browser flags were changed to bypass it. This walkthrough verifies the live routes, rendering and labels, not normal-speed device performance. Human visual acceptance, physical iPhone/Safari and device performance remain pending. The distant Basin landmarks were reviewed through the actual imported/rendered overview, not all visited in the authenticated account.

Saved live proof under `.wrangler/first-basin-env-work/`: `live-town-arrival.png`, `live-town-roundtrip-cross.png`, `live-path-3.png`, `live-basin-cave-mobile.png`, `live-path-4-mobile.png`, `live-the-basin-mobile.png`, `live-the-basin-desktop.png`, `live-path-5-blocked-mobile.png` and `live-completed-return-cross.png`. The live tab remains open at staging for human review.

## 19. Files/assets changed

Milestone edits: `PROJECT_CONTEXT.md`, `docs/ART_DIRECTION_V1.md`, `package.json`, `scripts/world-import.ts`, `world/cactigrow-world.ldtk`, `shared/world/generatedWorld.ts`, `shared/world/world.test.ts`, `shared/world/settlement.test.ts`, `shared/api/startingExperienceV1.test.ts`, `src/game-world/LdtkAreaScene.ts`, `src/game-world/localMinimap.ts`, `src/game-world/world.browser.test.mjs`.

New files: this report; `scripts/basin-environment-v1.mjs`; `scripts/pack-basin-environment-v1.py`; `world/first-basin-extension-v01.json`; `public/assets/world/tiles/world-first-basin-extension-v01.png`; `art-source/FIRST_BASIN_ENVIRONMENT_V1_PROMPTS.md`; three PNG masters under `art-source/world/first-basin/`; `src/game-world/basinEnvironmentPresentation.ts`; `src/game-world/basinEnvironmentPresentation.test.ts`; `src/game-world/basinEnvironment.browser.test.mjs`; `shared/world/basinEnvironment.test.mjs`.

Ignored evidence is under `.wrangler/first-basin-env-work/` and `.wrangler/first-basin-work/`. Preservation verifies156 unaffected pre-existing dirty paths,117 accepted art files,500 protected source snapshots, all11 authority projections and four complete untargeted Levels. The original150,496 bytes of mixed-encoding PROJECT_CONTEXT are preserved verbatim before its ASCII appendix. Explicit exclusions remain untouched: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, `local-ai-benchmark-report.txt`.

## 20. Commit/push status

No commit, push or index staging. HEAD remains `3499e542713c673eef572087a8ed86d46f6bdf37`. This milestone remains uncommitted for human visual review. Production is untouched.

## 21. Recommended next world-content milestone

After human acceptance, add a small authored First Basin exploration/content pass using these existing landmarks: restrained harvesting placements and introductory Area-specific NPC/content contracts, with explicit server-authoritative rewards and separately authored interactions/collision. Keep later Zones, combat and economy expansion out of that first content pass; confirm the chosen content scope before implementation.


## Accepted staging baseline checkpoint - 2026-10-07

The user accepted this milestone as part of the current staging visual/world development baseline and explicitly authorized committing/pushing the accepted work. This supersedes earlier visual-acceptance and commit/push hold language in this historical implementation report. Outstanding device/performance and other unperformed verification remain documented limitations. See PROJECT_CONTEXT.md, Accepted staging visual/world development baseline. Future development is staging only; no production deployment, database or configuration change is authorized by this checkpoint.
