# Settlement Art V1

Farm and Town presentation milestone, 2026-10-07. Character V2.1 and the existing desert art are the accepted staging baseline. Human settlement visual acceptance is pending; production deployment and commit/push are not authorized. This work preserves the pre-existing World Foundation V1 and Starting Experience V1 implementation and all prior uncommitted work.

## 1. Shared settlement architecture

One 64-entry, 1024 x 1024 RGBA atlas extends the accepted Southwestern materials. The manifest identifies ground, edge and prop slots, source crops, alpha bounds, sampling inset and foot registration. Saved LDtk visual layers feed a small shared Farm/Town presentation helper. Missing art retains the existing complete template presentation. No new gameplay, persistence, external integration, dependency or infrastructure is introduced.

## 2. Farm assets

Cultivated soil, timber fencing, irrigation pieces, propagation table/tray, wheelbarrow, soil bags, compost bin, raised-bed assets, shade canopy, tools and hose extend the homestead language. Barrels, crates, sacks, pots, baskets, benches and lanterns are reusable settlement assets. Raised beds and other props are artwork only; they do not create gameplay capacity or interactions. Sparse vegetation reuses the unchanged desert atlas.

## 3. Farm visual result

The existing 3000 x 1900 property is now a warm working homestead with a timber perimeter, cultivated material around Nursery/Garden, practical supplies and quieter continuous terrain. Five existing buildings retain their positions. The initial ground export was refined through imagegen after actual Farm review exposed brightness seams; the original source is retained for provenance. Final overview, entrances and 320/360/390-pixel captures were reviewed locally in actual Chrome/Phaser.

## 4. Building integration

Home, Nursery, Garden, Lab and Mail keep their accepted source/runtime image bytes, scales, origins, anchors and depth. Paved thresholds, cultivated soil, connected paths and nearby utility props ground the sprites. Shop and Market receive the same treatment with broader frontage paving. Existing artwork already contains its grounding shadows; the milestone does not replace or retune the seven building sprites. Garden's six display anchors and owned specimen projection remain unchanged.

The current Farm implements Nursery, Garden and Genetics Lab tutorial highlights; all three were exercised over the new art. No Mail tutorial highlight or Farm outbound tutorial target was found in the current guidance projection. The existing Cross Path `exit:to-player-farm` guidance remains unchanged. No substitute tutorial behavior was invented for those absent targets.

## 5. Farm paths

Authored swept-dirt paths replace the translucent road graphics. The southern entrance leads through the established central junction to Home, Nursery and Garden. Lab's visual branch continues to its existing approach at (2420,1425), rather than stopping against the west-side collision. Mail gains a visual branch to its existing front approach at (1120,1665); all four existing Mail approaches remain usable through the original controller. Roads never supply collision. Eight-pixel overlay authoring, feathered shoulders, rounded exposed corners and slight sampling overlap keep the material continuous without moving navigation points.

## 6. Town assets

Two bench views, lanterns, a botanical noticeboard, water trough, public cactus planter, cloth awning and cactus display stand add civic and market decoration. Sandstone edging, frontage paving, gate posts, barrels and crates are shared pieces. The noticeboard, benches and trough are noninteractive. There are no newly implemented Town NPCs or additional system locations.

## 7. Town visual result

The existing 2200 x 1500 Town has lighter swept ground, broader packed roads, warm sandstone frontage and a low stone perimeter. Accepted Shop/Market art remains unchanged. Restrained teal cloth, terracotta planters, benches, lanterns and practical market supplies distinguish Town from Farm while retaining the same world palette.

## 8. Social space

The existing central junction around (1100,850) is an obvious sandstone gathering area, with benches and public cactus planters nearby. It remains ordinary walkable space. The unchanged Town presence/layer transport, interpolation, profile interaction and chat scopes remain authoritative. Actual Chrome fixtures exercised saved masculine, saved feminine and legacy appearance projections, movement/idle, labels and profile clicks. This is fixture evidence, not a new live two-account acceptance claim.

## 9. Path 2 connection

The main road runs visibly through the existing southern gate. The 246 x 118 exit remains centered at (1100,1420); Town entry/Travel remains (1100,1280). Its authored target remains Path 2 `from-town-p1` at runtime (2280,440). No tiny replacement trigger, direct Farm/Town shortcut, loading screen change or new Area was added. Cross Path and Path 2 Levels remain completely unchanged; the managed earth/stone palette references their existing desert materials.

## 10. LDtk and layers

Farm/Town Level footprints remain 576 x 416 / 432 x 416 with their existing explicit runtime dimensions. Seven new definitions/instances per settlement provide Ground, GroundVariation, Paths, StructureGrounding, Decorations, Vegetation and BoundaryEdges; the importer maps Vegetation to a second runtime Decorations layer using the original desert atlas. The other layers use the new atlas. Ground/props/edges use a 16-pixel authoring grid; material overlays use an 8-pixel grid. Original definitions, all entity/IntGrid payloads and the other nine complete Levels remain unchanged. The project validates against the existing official LDtk 1.5.3 JSON schema. Runtime world version is `6c3174b34dfff7f0`.

| Authored layer | Farm tiles | Town tiles |
| --- | ---: | ---: |
| Ground | 936 | 702 |
| GroundVariation | 271 | 30 |
| Paths | 439 | 334 |
| StructureGrounding | 142 | 336 |
| Decorations | 20 | 18 |
| Vegetation | 11 | 6 |
| BoundaryEdges | 191 | 157 |

`node --experimental-strip-types scripts/settlement-art-v1.mjs --farm` authors Farm, `--town` authors Town, and `--all` refreshes both. Runtime consumes the saved project; this authoring recipe is not a second live geometry owner.

## 11. Collision and navigation

Actual pre/post Chrome snapshots match exactly: Farm has 20 registered static bodies and 47 navigation nodes; Town has 10 bodies and 16 nodes. Building registrations, interactions, approaches, Mail choices, Garden display anchors, spawn/Travel entries, boundaries, player radius, camera bounds, graph routes and minimap obstacles match the captured baseline. All eleven parsed runtime Areas preserve their authority hashes. Speed remains 245, local player depth 120, collision radius 27 and camera zoom 1.18. No collider or navigation implementation changed.

## 12. Minimap

Roads, cultivated material, storefront paving and the plaza derive directly from the Area's visual layers, with adjacent cells merged for SVG rendering. Existing registered obstacle rectangles, exits and player marker remain. The established walker rejects blocked/unreachable clicks and keeps valid routes; a new valid click replaces the active route. Actual mouse/touch input, blocked-point rejection, player marker updates and mobile layout were exercised. No separate authored map or additional request loop is introduced.

## 13. Scale

Character V2.1 sprites, registrations and animation remain unchanged. Decorative source subjects fit proportionally inside 128 x 128 canvases; the importer transforms their ground anchors while retaining square display bounds despite compact Level X/Y scaling. New props share source foot baseline 122 with the one-pixel sampling inset accounted for. Existing vegetation retains its registration. Adult characters, doors, barrels, benches, posts and paths were reviewed in actual scene captures. Future authored flips preserve world-facing blend masks. Device-specific human judgment remains pending.

## 14. Performance

The single new PNG is **911,092 bytes** (889.738 KiB), **1024 x 1024**, approximately **4 MiB decoded RGBA**. SHA-256: `aa0f9d9c11fd0d70b7bff08e4ed48da05135a25d7b624e0e9db4e12239211c53`. The reused desert atlas adds 3 MiB to each settlement's terrain source pixels; atlas frames share those pixels.

| Measured in actual Chrome fixture | Farm | Town |
| --- | ---: | ---: |
| Terrain source atlas pixels | 7 MiB | 7 MiB |
| Generated blend/round canvases | 54 | 44 |
| Additional canvas RGBA bytes | 3,429,216 (3.270 MiB) | 2,794,176 (2.665 MiB) |
| Combined terrain source pixels | 10.270 MiB | 9.665 MiB |
| Settlement images | 2010 | 1583 |

These are decoded source-pixel estimates, not measured GPU allocation, mipmaps, object overhead or physical-phone performance. Character/building textures are unchanged and excluded. Single-material overlays keep the cache bounded; the initial Farm prototype used 115 canvases/6.965 MiB before refinement. Five preserved source PNGs are authoring files, not loaded by the game. No independent PNG request per prop is added.

## 15. Staging Worker

Guarded staging deployment succeeded at **2026-10-07 22:21:31 UTC**. Worker `cactigrow-staging` serves `https://dev.cactigrow.com`, version **`e93ab988-702d-47e5-87c8-01f77f4933f0`** at **100% traffic**; deployment ID `1c368647-219c-4a99-8779-0bd27dafb0d5`. Previous version: `ff80f42e-086c-4998-88a6-5074c73d6b33`. The authenticated browser loads `/assets/index-GWEDkyZ5.js` and the new settlement presentation. Production, Access, DNS, bindings and database schema/grants remain unchanged. Live review uses ordinary walking and Travel only; no manual player data, tutorial, identity or economy writes were performed.

## 16. Verification

Final results are recorded under ignored `.wrangler/settlement-art-work/`: **267 test executions passed, zero failures or skips**. Settlement pure tests: 9/9. Accepted-system regressions: 208 checks across thirteen scripts, with shared cases counted per execution. World: 19/19 with real isolated PostgreSQL. Starting: 29/29 with real isolated PostgreSQL and the full Chrome application flow. Dedicated Farm/Town browser: 1/1, including seven entrances, four Mail approaches, three real tutorial highlights, 320/360/390-pixel map/touch/exit checks, three remote variants and cleanup. Full world browser: 1/1, all 26 transitions, 960 character poses and 80 protected-eye checks, keyboard and real canvas-click motion, remote players, mobile HUD and listener cleanup; no recorded browser errors. Final saved authoring reproduces LDtk, generated world, manifest and atlas bytes exactly.

`npm run build`, `npm run build:staging`, `npm run lint`, Worker type checking/type freshness and staging dry-run passed. Existing large-chunk and `pg` concurrent-query deprecation warnings remain. The standard World runner completed all nineteen assertions but retained an idle handle; the final same-file run uses Node's `--test-force-exit` after all known tests complete and prints a clean summary. No application cleanup was added to conceal that runner issue. Existing test adaptations retain the original authority, 960-pose and all-transition assertions: the desert-ground filter distinguishes reused vegetation; boundary counts include settlement artwork; keyboard input releases before slow screenshots and physically returns to its verified clear point before the real ground click.

## 17. Visual acceptance

Farm was implemented and reviewed locally before Town authoring. Actual desktop and narrow-viewport Chrome/Phaser reviews pass for composition, entrances, guidance, minimap and character visibility. Authenticated staging Chrome loaded the new bundle and both settlement scenes; ordinary Town-to-Farm-to-Town Travel succeeded. Both maps show derived material surfaces (Farm 100 merged rectangles, Town 72), and map clicks visibly moved their players/markers. Staging Tester 2 remained Level 7 with currency 0 and was left in Town beside the plaza. Screenshot proof is retained under `.wrangler/settlement-art-work/` as `live-staging-farm.png`, `live-staging-town.png` and `live-staging-town-plaza-map.png`. This review changed only ordinary world location through walking/Travel; no player/tutorial reset, appearance/name save, live economic command or chat message was performed.

Human settlement staging visual acceptance, physical phone/Safari behavior and performance, and live paired-account Town acceptance remain open. Automated remote-player/browser fixtures are separate from those manual checks. Commit/push and production promotion remain pending the user's explicit acceptance/instruction.

## 18. Exact milestone files

The milestone changes fourteen pre-existing paths and adds fourteen files. Earlier uncommitted World Foundation, Starting, character and art work remains present.

Modified relative to the starting working tree:

```text
PROJECT_CONTEXT.md
docs/ART_DIRECTION_V1.md
package.json
scripts/world-import.ts
shared/world/generatedWorld.ts
shared/world/types.ts
shared/world/world.test.ts
src/game-world/FarmTestScene.ts
src/game-world/LocalMinimapView.tsx
src/game-world/TownTestScene.ts
src/game-world/localMinimap.css
src/game-world/localMinimap.ts
src/game-world/world.browser.test.mjs
world/cactigrow-world.ldtk
```

Added:

```text
art-source/SETTLEMENT_ART_V1_PROMPTS.md
art-source/world/settlement/world-settlement-edges-v01-master.png
art-source/world/settlement/world-settlement-farm-props-v01-master.png
art-source/world/settlement/world-settlement-ground-v01-master-r02.png
art-source/world/settlement/world-settlement-ground-v01-master.png
art-source/world/settlement/world-settlement-town-props-v01-master.png
docs/SETTLEMENT_ART_V1.md
public/assets/world/tiles/world-settlement-master-v01.png
scripts/pack-settlement-art-v1.py
scripts/settlement-art-v1.mjs
shared/world/settlement.test.ts
src/game-world/settlement.browser.test.mjs
src/game-world/settlementPresentation.ts
world/settlement-master-v01.json
```

All 110 accepted art files remain byte-identical. Scope checks preserve 140 untouched prior dirty paths, 199 protected source snapshots and the original 143,993-byte PROJECT_CONTEXT prefix. The unrelated `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md` and `local-ai-benchmark-report.txt` are retained and excluded from this milestone. Generated local evidence/builds are ignored artifacts.

## 19. Git status

No commit, push or staging of paths was performed. HEAD remains `3499e542713c673eef572087a8ed86d46f6bdf37`. Commit/push must wait for human visual acceptance. Production deployment has not been performed or authorized.

## 20. Recommended next milestone

After human acceptance, polish the Path 2/Cross Path connecting-road art while preserving existing topology. Then plan named Town NPC/content locations against the current character and world contracts. Do not automatically introduce new vendors, economy, quests or Areas as part of this settlement pass.


## Accepted staging baseline checkpoint - 2026-10-07

The user accepted this milestone as part of the current staging visual/world development baseline and explicitly authorized committing/pushing the accepted work. This supersedes earlier visual-acceptance and commit/push hold language in this historical implementation report. Outstanding device/performance and other unperformed verification remain documented limitations. See PROJECT_CONTEXT.md, Accepted staging visual/world development baseline. Future development is staging only; no production deployment, database or configuration change is authorized by this checkpoint.
