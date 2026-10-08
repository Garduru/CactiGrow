# CactiGrow Art Direction V1

The static character implementation below is historical. [Character System V2.1](CHARACTER_SYSTEM_V21.md) supplies the current accepted staging character presentation. The current desert/world art and Character V2.1 were accepted as the staging visual baseline for [Settlement Art V1](SETTLEMENT_ART_V1.md). The original V1 implementation and acceptance notes below remain a historical record.

Staging milestone from the current accepted World Foundation V1 and Starting Experience V1 working tree. Settlement Art V1 still requires human visual acceptance before commit/push. Production deployment is not authorized.

## Visual reference

Follow [the art/world bible](CACTIGROW_ART_WORLD_BIBLE.md) and locked [Building Standard V2](BUILDING_ART_STANDARD.md). Warm, handcrafted Southwestern desert; stylized hand-painted 3D forms, restrained three-quarter perspective, upper-left daylight, clear silhouettes and quiet material detail. Existing Farm/Town building and plant masters remain the reference and are unchanged.

| Material | Palette |
| --- | --- |
| Sand and road | light ochre, sandstone tan, dusty compacted earth |
| Canyon / soil | warm terracotta, brown ochre, umber crevices |
| Vegetation | muted olive, gray-green, dry straw |
| Equipment / clothing | linen, sage, slate, walnut, aged copper |
| UI | existing brown surfaces, copper accents, tan text, Georgia display headings |

Avoid pixel/voxel art, anime/chibi proportions, realistic portraits, glossy plastic, neon and excessive ground noise. UI typography and global tokens remain unchanged.

## Master world set

`world/desert-master-v01.json` describes `CactiGrowDesertMasterV1`: a 1024 × 768 atlas, eight columns and six rows of 128-pixel source tiles, with 48 reusable entries.

- Ground: four variants each of light sand, packed dirt, roadway dirt and rocky soil (16 entries).
- Boundary: 16 connected sandstone wall/ledge arrangements. North/east/south/west blocked-neighbor bits select straight runs, exposed edges, turns and junctions.
- Props: loose rocks, boulder, dry grass, shrub, flowers, small cactus cluster, dead wood, arrow trail marker, horizontal/vertical fences, terracotta pot and timber planter; four additional rock/grass/shrub/marker variations.

LDtk authoring keeps its existing 32-unit visual cells and 16-unit IntGrid. Source resolution is independent from geometry. Starting Spawn presents these cells at 128/64 runtime units; Path 1 and Cross Path at 160/80. No collision or object footprint is inferred from art.

| LDtk layer | Use |
| --- | --- |
| Ground | Quiet full ground coverage |
| GroundVariation | Authored road surface; runtime feathers exposed shoulders and concave joins |
| BoundaryEdgesMaster | Connected canyon art derived from the existing IntGrid; exported as BoundaryEdges |
| Decorations | Sparse noncolliding raster props |
| IntGrid | Existing collision truth, unchanged |
| WorldEntities | Existing NPC, cactus, pot, spawn and exit authority, unchanged |

The legacy boundary layer/atlas remains for Path 5. Eight untargeted LDtk Levels, including Farm/Town, keep their existing authored Level data. The importer re-evaluates the supported rules from IntGrid; an editor auto-tile cache is never collision or boundary truth. `scripts/world-art-v1.mjs` is an explicit visual-authoring recipe, not runtime state.

Starting Spawn uses a sheltered sand clearing and a legible road passing the original Mara/cactus anchors. Path 1 continues the same route language around its existing tutorial pot. Cross Path uses light sand around darker compacted-earth branches toward the Farm and onward Basin routes; sparse dry vegetation introduces the Basin palette. All three retain their existing dimensions, movement, camera, interactions, highlights, minimap, tutorial progression and automatic exits.

## Shared characters

One registered static raster kit serves creator previews, local players in every staging Area/Farm/Town, appearance-bearing Town remotes and NPC presets. Six alpha-preserving modules share a 128 × 224 canvas; world display is 64 × 112 with bottom-center origin and offset (0,13). The existing 54 × 54 physics container, 27-unit radius and render-depth rules remain unchanged. No new directional/walk animation is invented.

The grower uses compact adult game proportions, practical rolled sleeves, straight trousers, boots and a belt. Clothing folds and material lighting survive bounded palette changes. Mara is the reusable `mara` NPC preset: deeper skin tone, silver tied-back hair, sage shirt, walnut trousers, straw brim and a modest field satchel. She uses the same body/compositor as players and a lower NPC depth; her existing compact name/interaction treatment remains.

V1 choices: one body/base, three skin tones, two hairstyles, four hair colors, four shirt colors, three trouser colors, no hat/straw brim/trail cap, and optional field satchel. The existing authoritative character-name step still comes first; appearance then has Face and hair → Field outfit, live preview, Back, and one final save.

Appearance remains in the server Starting checkpoint. Additive optional bounded indices preserve legacy `{skin,shirt}` checkpoints; missing modules use deterministic defaults. The same public whitelist carries appearance through supported Town presence. No migration, client save store, identity remapping, equipment unlock or gameplay value is introduced. Production/development characters retain their legacy presentation; only staging loads the new modules.

## Asset contract and future adaptation

Runtime world: `public/assets/world/tiles/world-desert-master-v01.png`. Runtime characters: `public/assets/characters/player/desert-*-v01.webp`. NPCs use shared modules and preset data rather than separate baked bodies. Source sheets: `art-source/world/desert/` and `art-source/characters/desert-grower-v01/`. Generation prompts: [ART_DIRECTION_V1_PROMPTS.md](../art-source/ART_DIRECTION_V1_PROMPTS.md).

Use category/material/role plus version in filenames. Preserve source alpha and registration; optimize runtime dimensions rather than shipping source sheets. Add new atlas tiles or modules deliberately with a manifest/registration entry. Never change a deployed immutable V01 asset in place after acceptance; create V02 for a later revision.

Future Farm/Town adaptation should reuse this material palette and character registration while preserving locked building scale, anchors, colliders and navigation. Plan visual ground/path layers independently from gameplay geometry. Extend only an explicitly approved Area at a time; Town/Farm tiles, the remaining Basin, future Zones and gameplay systems are outside this milestone.

## Release and acceptance

Read-only staging metadata preflight verified the existing isolated database/runtime role and required privileges. No live tutorial reset or progression is part of this art release. The connected Tester 2 account is preserved at its empty name form.

Automated acceptance covers bounded/public appearance, real server persistence, creator navigation, desktop/mobile previews/dialogue, the full tutorial, all 26 physical Area transitions, unchanged collision/topology/entities and locked artwork hashes. Human staging visual acceptance must still inspect Starting Spawn, Path 1, Cross Path, Mara, character creation and in-world player scale. Physical-phone acceptance is separate.

## Milestone report

1. **Visual direction:** warm Southwestern desert, painterly material detail, adult stylized silhouettes, sand/terracotta/olive/copper. Existing locked Nursery, Lab, Home, Garden, Shop, Marketplace and Mailbox art supplied the scale/material reference. Their source, registration and collision are preserved.
2. **Tileset architecture:** one 1024 × 768 runtime atlas with 48 entries, a category manifest and organized LDtk visual layers. The existing IntGrid remains collision truth. Visual road blending is cached presentation data, never navigation authority.
3. **Tiles and props:** 16 ground variants, 16 connected sandstone boundary arrangements and 16 prop entries. The prop foundation includes rocks, boulder, dry grass, shrubs, flowers, cactus cluster, debris, trail markers, fence pieces, pot and planter. It is a minimal expandable set; not every entry is placed in the three Areas.
4. **Starting Spawn:** sheltered sand, darker road and sparse decoration retain the original Mara, Wild San Pedro and exit anchors. Tutorial highlights and interactions still consume server state.
5. **Path 1:** a continuous road leads from the sheltered start around the unchanged tutorial pot toward Cross Path, with restrained rocks and plants outside the main route.
6. **Cross Path:** contrasting sand and earth make the Farm-facing branch and onward roads clear. This is the First Basin foundation, not the final Basin pass.
7. **Character style:** practical desert grower, rolled sleeves, trousers, boots and readable headwear; one 128 × 224 registered static raster kit displayed at 64 × 112 in-world. The existing renderer had no walk/directional animation assets; animation remains a later art task.
8. **Creator options:** one base, three skin tones, two hairstyles, four hair colors, four shirt colors, three trouser colors, three headwear states and two accessory states. Name selection comes first, followed by Face and hair / Field outfit, retained Back navigation and a single authoritative save. Preview loading/failure states prevent saving before the artwork is visible and provide retry.
9. **Mara:** reusable `mara` preset, deeper skin, silver tied-back hair, sage shirt, walnut trousers, straw brim and field satchel. The original `mara-guide` entity ID, position, compact name and interaction state stay intact.
10. **Shared renderer:** `shared/characters/appearance.ts` defines bounded choices/presets. `src/characters/characterArt.ts` composites the same modules for React preview and Phaser. `src/game-world/PlayerCharacter.ts` creates players/NPCs and caches each resolved look. Local avatars in all Areas/Farm/Town and appearance-bearing Town remotes use it. Legacy placeholder remotes retain their existing fallback. Appearance persists in the existing server checkpoint and supported public presence contract, with deterministic defaults for legacy two-field looks; no new database or transport.
11. **Asset locations:** world runtime in `public/assets/world/tiles/`, character runtime in `public/assets/characters/player/`, masters/registration/export scripts in `art-source/`, atlas manifest in `world/`. Built-in imagegen generated new raster masters using locked buildings as style references. Exact new-image and refinement prompts are in [the generation record](../art-source/ART_DIRECTION_V1_PROMPTS.md).
12. **Performance:** world atlas is 1,186,281 bytes, about 61% smaller than the previous 3,025,732-byte desert PNG. Decoded atlas memory falls from about 6 MiB to 3 MiB. Six lossless character WebPs total 49,984 bytes; decoded sources use about 672 KiB and each cached appearance about 112 KiB. Active Areas cache 18–25 road composites (about 1.09–1.51 MiB) plus four ground composites (about 248 KiB). These are created during scene setup; no new per-frame shader, polling, API requests or dependency. These are dimensions/byte estimates, not physical-device FPS measurements.
13. **Staging Worker:** `cactigrow-staging`, version `3c01fe75-0b79-47df-81c7-e1771c13b836` at 100%, on [dev.cactigrow.com](https://dev.cactigrow.com/world). Deployment evidence is recorded below. Production, schema, grants, roles, Access, DNS and bindings were not changed. The existing live name-selection account was neither reset nor progressed.
14. **Verification:** Starting 27/27 with disposable PostgreSQL and full Chrome tutorial/Farm/research/breeding flow; World 19/19 with PostgreSQL; real Phaser browser 1/1 with 26 physical transitions; 125/125 affected regressions across characters, chat, navigation, minimap, client, menu, Worker, Dev Tools, multiplayer client and reconciliation. All have zero skips. Official LDtk 1.5.3 schema validation, client/Worker types, production and staging builds, lint, guarded staging dry run and whitespace checks passed. Existing Vite bundle-size and pg concurrency warnings remain.
15. **Visual acceptance:** automated desktop/mobile screenshots and agent review passed for the three Areas, creator, Mara, player scale and supported remote appearance. Creator/HUD checks cover 320/360/390px; Mara dialogue covers 320/390px. Preview/dialogue stay visible, the outdoor HUD stays one row and horizontal overflow is absent in those checks. Final screenshot review led to feathering concave road corners as well as straight shoulders. Human staging visual acceptance and a physical-phone walkthrough remain pending; static facing and subtle terrain tonal joins should be assessed during that review. No human approval is claimed.
16. **Files changed:** see the exact task-relative inventory below: 20 modified and 23 added paths. Changes extend the current dirty baseline; all 74 baseline files remain and 57 are byte-for-byte unchanged. Locked artwork hashes and all 11 Levels' authority/topology/collision/entities match the task-start snapshot; eight untargeted Level payloads are unchanged.
17. **Commit/push:** neither performed. Manual visual acceptance is the user's gate before either action. Unrelated archive/audit/benchmark files remain untouched and unstaged.
18. **Next:** complete the human staging review, record accepted registrations/materials, then authorize one focused Farm or Town ground/path adaptation using this reference. Future NPCs reuse appearance presets. Remaining Basin/Zones, animation and expanded art choices require separate scoped milestones.

### Review evidence

Screenshots are local automated-fixture evidence, not live user acceptance:

| Surface | Desktop | Narrow screen |
| --- | --- | --- |
| Starting Spawn | [Preview](../.wrangler/art-direction-work/world-art-starting-spawn-tutorial-desktop.png) | [390 px](../.wrangler/art-direction-work/world-art-starting-spawn-tutorial-mobile.png) |
| Path 1 | [Preview](../.wrangler/art-direction-work/world-art-path-1-desktop.png) | [390 px](../.wrangler/art-direction-work/world-art-path-1-mobile.png) |
| Cross Path | [Preview](../.wrangler/art-direction-work/world-art-cross-path-1-desktop.png) | [390 px](../.wrangler/art-direction-work/world-art-cross-path-1-mobile.png) |
| Creator | [Face](../.wrangler/art-direction-work/creator-face-desktop.png), [outfit](../.wrangler/art-direction-work/creator-outfit-desktop.png) | [320 px](../.wrangler/art-direction-work/creator-outfit-320.png), [360 px](../.wrangler/art-direction-work/creator-outfit-360.png), [390 px](../.wrangler/art-direction-work/creator-outfit-390.png) |
| Mara dialogue | [Preview](../.wrangler/art-direction-work/mara-dialogue-desktop.png) | [320 px](../.wrangler/art-direction-work/mara-dialogue-320.png), [390 px](../.wrangler/art-direction-work/mara-dialogue-390.png) |
| Farm player / Town remote | [Farm](../.wrangler/art-direction-work/player-farm-appearance.png) | [Town remote](../.wrangler/art-direction-work/town-modular-remote.png) |

For manual acceptance, inspect the creator after the normal name step, Mara/Wild San Pedro and road/canyon boundaries at Spawn, the Path 1 pot, Cross Path's Farm branch, and player scale against existing Farm/Town buildings. Confirm Travel/minimap/highlights and appearance after refresh/relogin, then repeat on a physical phone. Supported two-account Town appearance is a separate live check. Do not reset live player state merely to inspect art.

### Staging release evidence — 2026-10-07

Guarded `build:staging`, `dry-run:staging` and `CACTIGROW_DEPLOY_CONFIRM=staging npm run deploy:staging` completed. Cloudflare lists version `3c01fe75-0b79-47df-81c7-e1771c13b836`, deployed at `2026-10-07T09:34:42.486Z`, at 100%. It supersedes the initial art upload `5afc17b5-081f-4576-9c71-72c0a08b03da`; the pre-art baseline was `8b76ff3e-bb94-4aec-9691-9b66b8a5b780`.

Authenticated Chrome refreshed the existing empty name form and loaded `index-CReKnBii.js` / `index-BWfLopHK.css`, matching the final staging build. It remained at the name gate; no new appearance, tutorial action, reset or gameplay mutation was submitted. Direct protected health navigation was blocked by the browser client; the anonymous endpoint still returns the expected Access redirect. That is protection evidence, not an authenticated health-200 claim. Live art walkthrough/relogin/two-account acceptance remains manual.

World version is `4f4313e5dad8c339`; LDtk SHA256 is `4f4313e5dad8c339764d684eba6153069f0ff3b57fa68c9484f8846a089fc04d`. Runtime atlas SHA256 is `9b1885ecad13b75562ae687faaebccf8abf25b1b92dfa0acc40520338d9f6393`. Final corner refinement did not change these source bytes. The exact authority digest remains `e22e312aaa92f0696e79a163b8f0b3a4016a1e099bdf4e5f8b84cdd11d07c8b6`.

After the final corner refinement, the focused World suite passed 16/16, the actual browser again passed 1/1 with all 26 transitions, both builds and client/Worker types passed, and lint/dry-run/whitespace/invariant checks passed. The previously completed real PostgreSQL Starting 27/27, World 19/19 and 125 regressions cover unchanged authority and character systems. Final logs, release summary and baseline/file inventories are under `.wrangler/art-direction-work/`; full browser results are `.wrangler/starting-browser/acceptance.json` and `.wrangler/world-browser/result.json`. [Post-corner verification](../.wrangler/art-direction-work/world-browser-post-corner-verification.json) records the actual completed tool output and final screenshot/result timestamps; it is a reconstructed evidence record, distinct from the preserved earlier stdout log.

### Task-relative file inventory

Modified since milestone start (preserving earlier uncommitted changes in overlapping files):

```text
PROJECT_CONTEXT.md
package.json
scripts/world-import.ts
server/starting/startingUiAcceptance.mjs
shared/api/startingExperienceV1.test.ts
shared/api/startingExperienceV1.ts
shared/world/generatedWorld.ts
shared/world/types.ts
shared/world/world.test.ts
src/features/menu/gameMenu.runtime.test.ts
src/features/starting/AppearanceSetup.tsx
src/features/starting/starting.css
src/game-world/FarmTestScene.ts
src/game-world/LdtkAreaScene.ts
src/game-world/LdtkWorldPage.tsx
src/game-world/PlayerCharacter.ts
src/game-world/TownTestScene.ts
src/game-world/world.browser.test.mjs
src/game-world/worldTravel.runtime.test.mjs
world/cactigrow-world.ldtk
```

Added:

```text
art-source/ART_DIRECTION_V1_PROMPTS.md
art-source/characters/desert-grower-v01/desert-grower-modules-master-v01.png
art-source/characters/desert-grower-v01/prepare-assets.py
art-source/characters/desert-grower-v01/registration.json
art-source/world/desert/world-desert-canyon-v01-master.png
art-source/world/desert/world-desert-ground-v01-master.png
art-source/world/desert/world-desert-props-v01-master.png
docs/ART_DIRECTION_V1.md
public/assets/characters/player/desert-field-satchel-v01.webp
public/assets/characters/player/desert-grower-base-v01.webp
public/assets/characters/player/desert-hair-cropped-v01.webp
public/assets/characters/player/desert-hair-tied-back-v01.webp
public/assets/characters/player/desert-hat-cap-v01.webp
public/assets/characters/player/desert-hat-straw-v01.webp
public/assets/world/tiles/world-desert-master-v01.png
scripts/pack-world-art-v1.py
scripts/world-art-v1.mjs
shared/characters/appearance.test.ts
shared/characters/appearance.ts
src/characters/CharacterPreview.tsx
src/characters/characterArt.ts
src/game-world/worldTilePresentation.ts
world/desert-master-v01.json
```

Existing test-fixture repairs are limited to the CSS test loader, asynchronous Nursery hydration, artwork-agnostic geometry/remote assertions, updated visual-layer count and the existing guidance observer shim. Production code unrelated to this art milestone was not refactored. `.wrangler/` evidence/build artifacts are ignored, not release source.

### Persistence compatibility

The new reader accepts legacy `{skin,shirt}` and additive V1 modules. Reload open staging tabs before reviewing: an old bundle can reject expanded checkpoint/presence messages. An older Worker that validates exactly those two fields cannot read a newly saved modular checkpoint. Once a staging player saves V1 choices, a presentation rollback must retain the expanded appearance reader/public validator rather than blindly restoring the previous Worker. The existing checkpoint loader rejects invalid data; it does not silently reset gameplay. No live appearance save was made by this task.

## Settlement Art V1: Farm and Town

This extension follows the accepted desert world and Character V2.1 staging baseline. Farm is a working cactus grower's homestead; Town is a modest Southwestern plant trading and social hub. Seven accepted building sprites and their registrations remain unchanged. The authored settlement artwork never supplies collision, interaction or persistent gameplay truth. See [the settlement report](SETTLEMENT_ART_V1.md) for verification and staging acceptance status.

### Farm palette, materials and composition

Use warm packed ochre earth, lighter swept sandy paths, terracotta cultivated soil, worn sandstone doorstep paving, walnut timber, natural linen and muted cactus greens. Paths lead from the existing southern entrance through the existing central junction to Home, Nursery, Garden, Lab and Mail. Keep cultivated texture near Nursery/Garden; reserve pale paving for thresholds. Road shoulders feather into surrounding earth. Small irrigation lines and propagation supplies communicate practical work, without creating usable benches, containers or new capacity.

Place barrels, soil bags, terracotta pot stacks, a wheelbarrow and tools beside work areas. Keep props off doors, approaches, path centers and tutorial highlight silhouettes. Scatter sparse existing desert vegetation near the property edges. Avoid evenly filling every empty space. Ground artwork connects Lab and Mail to their existing approaches without moving either interaction. A timber perimeter follows existing registered walls and leaves the existing exit opening clear.

### Town palette, materials and social space

Use lighter swept dirt across Town, broader packed-earth roads and warm sandstone frontage/plaza paving. Keep stone and terracotta related to the desert pack and Farm; add restrained teal cloth at a market-side awning. Shop and Market retain their accepted artwork. Frontage paving and a connecting path ground their existing entrances. A sandstone gathering area occupies the established central junction, with benches, public cactus planters, a water trough and lanterns nearby. The botanical noticeboard is decoration; it has no quest or interaction behavior.

The main road continues through the existing southern gate to Path 2. Gate artwork and low stone boundary runs frame the opening. The full existing exit trigger, spawns and transitions remain unchanged. No additional NPCs, vendors, shops or social systems are introduced. Remote players and their existing labels remain above the decorative layers.

### Asset mapping and authoring

| Set | Assets | Use |
| --- | --- | --- |
| Shared world | Unchanged Desert Master V1 sand/soil, canyon walls and vegetation; unchanged character/plant/building masters | Wilderness reference and sparse existing vegetation in both settlements |
| Shared settlement | IDs 0-7 packed earth/swept dirt, 12-15 sandstone pavers; 16-23 low stone/drainage edges; 24-27 timber fencing/gate posts; 32-39 barrels/crates/sacks/pots/baskets/watering can/tools; 56-59 thresholds/paver borders | Reusable terrain, boundaries, door grounding and practical decoration |
| Farm extension | IDs 8-11 cultivated soil; 28-31 irrigation joins; 40-47 propagation table, seedling tray, wheelbarrow, soil bags, compost, raised beds and shade canopy; 60-63 bed borders/drain/hose | Cultivation and homestead utility; raised beds remain visual assets, not gameplay capacity |
| Town extension | IDs 48-55 two bench views, lantern, botanical noticeboard, trough, public cactus planter, cloth awning and cactus display stand | Frontage and communal plaza decoration; benches/noticeboard/trough are noninteractive |

`world/settlement-master-v01.json` maps all 64 entries in one 1024 x 1024 RGBA atlas (`world-settlement-master-v01.png`), with eight columns/rows of 128-pixel slots. Four selected generated source sheets live under `art-source/world/settlement/`; the initial ground sheet is also retained beside its refined R02 replacement. Exact prompts are recorded in `art-source/SETTLEMENT_ART_V1_PROMPTS.md`. `scripts/pack-settlement-art-v1.py` deterministically isolates subjects, crops, proportionally fits and registers the atlas. It does not repaint source pixels or modify accepted artwork.

LDtk uses new, dedicated `SettlementGround`, `SettlementGroundVariation`, `SettlementPaths`, `SettlementStructureGrounding`, `SettlementDecorations`, `SettlementVegetation` and `SettlementBoundaryEdges` tile definitions. Ground, props and boundary layers use a 16-pixel authoring grid; the three material overlays use an 8-pixel grid for finer path/bed/courtyard contours. Existing global definitions remain intact. Vegetation references the original desert atlas and maps to runtime Decorations. The other layers reference the settlement atlas. Existing Entities/IntGrid are unchanged. The compact Farm/Town Level footprints remain 576 x 416 / 432 x 416; their explicit runtime dimensions remain 3000 x 1900 / 2200 x 1500.

Terrain/edges use the existing Level-local transform. Decorative silhouettes use 128 x 128 display canvases, proportional authored fits and a shared source foot baseline of 122. The importer accounts for the one-pixel sampling inset when placing that foot at the authored anchor; reused desert vegetation retains its old baseline. This prevents the compact topology's unequal X/Y scale from stretching props. Repeated boundary strips use actual alpha bounds and a small overlap for continuity. Ground/road blends reuse cached frames and canvas textures, rather than independent images for each cell. Existing character scale, camera behavior and seven building anchors are unchanged.

`scripts/settlement-art-v1.mjs --farm` authors Farm first; `--town` authors Town; `--all` reproducibly refreshes both visual sets. Runtime consumes saved LDtk data. Roads, cultivated areas and courtyards on the minimap derive from those same layers; registered obstacle geometry and the existing walker remain authoritative. No second map, database migration or dependency is introduced. The single new atlas costs 4 MiB of decoded RGBA; source masters are authoring assets and are not loaded by the game. Measured cache/scene totals and compressed bytes are in the settlement report.

## First Basin Environment V1

The accepted Settlement Art V1, Character/NPC V2.1 and Starting Experience V1 form this milestone's baseline. Cross Path remains the legible four-way hub: retain the existing sand, broad junction and canyon edge, add a narrower packed center and a few directional trail markers. Its center stays open for players. Path 2 uses a broader maintained earth route and modest roadside vegetation as it winds toward Town. Path 3 uses a narrower remote canyon trail, sparse dry roots and an obvious lower fork: Cave west, Path 4 east, unfinished Path 5 south. Path 4 opens into a longer rugged approach with quiet mineral soil pockets and broken rock beside existing walls.

Basin Cave uses its own subdued dusty gray-tan stone, darker compacted earth, connected stratified walls and restrained rubble/roots/damp ground. The source palette supplies the difference from bright outdoor sand; no tint overlay or lighting system is added. Continuous wall artwork derives from the same unchanged IntGrid as physical collision. Outside disconnected pockets use darker ground so the chamber reads independently. The cave is the authored side branch returning to Path 3; reaching Path 4 requires that return.

The Basin remains a large open wilderness. Use broad sand, quieter pale dry-wash regions and long sightlines, with five separated landmarks: the entrance cactus grove, a stratified mesa shoulder, a pale wash with small rubble, a central cairn and a distant cactus/rubble ridge. Keep the space between these groups quiet. Landmarks are visual orientation aids, not new interactions, harvesting rewards or collision. Solid-looking tall rocks are grounded on existing blocked terrain. Modest roots, loose rubble, cactus and cairns are visual decoration. Future populated content must continue to use independently authored gameplay geometry.

Path 5 uses the same canyon material and a rockslide beyond the existing blocked trigger. Preserve its exact message, **Route under construction.**, a readable approach and the return opening. Do not imply a usable route or introduce later Areas.

### Reusable extension and saved authoring

The accepted desert atlas remains unchanged. `world/first-basin-extension-v01.json` maps one additional reusable 1024 x 512 atlas, `world-first-basin-extension-v01.png`: IDs 0-3 dusty cave stone, 4-7 cave earth, 8-23 connected NESW cave walls, and 24-31 mineral rubble, dry roots, weathered rock, damp floor, stratified pillar, wild cactus cluster, trail cairn and rockslide debris. Three original generated sheets and exact prompts are retained under `art-source/world/first-basin/` and `art-source/FIRST_BASIN_ENVIRONMENT_V1_PROMPTS.md`. `scripts/pack-basin-environment-v1.py` crops, proportionally fits and packs the source pixels without repainting accepted artwork.

Dedicated additive LDtk definitions are `BasinGround` (32-pixel authoring grid), `BasinGroundFine` (16, for Cave/Path 4 dimensions), `BasinGroundVariation`, `BasinPaths` (8), `BasinDecorations`, `BasinVegetation`, `BasinBoundaryEdgesMaster` and `BasinCaveBoundaryEdgesMaster` (16). The importer normalizes their visual names, derives connected walls only from IntGrid, and ignores the editor's cached wall artwork. Old definitions and all entity/IntGrid payloads remain unchanged. Cross retains its original four visual layers and adds detail/Paths; the other six environments receive complete floor/path/wall sets atomically. All Level dimensions, exits and spawns remain unchanged.

Extension props use explicit square display sizes from their tileset custom data and source foot 122 with the one-pixel inset; the importer validates their final display bounds. These envelopes affect presentation only. The isolated Basin renderer caches cropped frames, soft road shoulders and convex corners. Mixed floor materials stay opaque to avoid fading all floor edges into a single dark undercoat. The original terrain renderer and shared character/camera systems remain intact. The existing minimap derives rough-Area Paths and variation from these saved layers and uses its existing ground-walk port. Farm/Town map surfaces remain identical.

`node --experimental-strip-types scripts/basin-environment-v1.mjs --all` explicitly refreshes the saved visual layers; `npm run world:generate` imports them. The recipe is byte-idempotent. This shared extension adds 918,520 encoded bytes and 2 MiB decoded RGBA; no per-Area background textures are introduced. Active-scene cache/object observations, validation, live staging evidence and all 21 requested report items are in [First Basin Environment V1](FIRST_BASIN_ENVIRONMENT_V1.md). Production remains untouched and this milestone awaits human visual acceptance before commit/push.



## Accepted staging baseline checkpoint - 2026-10-07

The user accepted this milestone as part of the current staging visual/world development baseline and explicitly authorized committing/pushing the accepted work. This supersedes earlier visual-acceptance and commit/push hold language in this historical implementation report. Outstanding device/performance and other unperformed verification remain documented limitations. See PROJECT_CONTEXT.md, Accepted staging visual/world development baseline. Future development is staging only; no production deployment, database or configuration change is authorized by this checkpoint.
