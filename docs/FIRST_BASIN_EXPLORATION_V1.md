# First Basin Exploration V1

Staging-only content milestone, 2026-10-07, on accepted checkpoint `e55e77a1bcaef0fca8a599ac11bc87dce055d1df`. Production deployment, commit and push are not authorized by this milestone. The three unrelated untracked files remain excluded.

## 1. Wild harvestable architecture

Saved LDtk `HarvestablePlant` entities extend the existing controlled tutorial entity with nullable wild fields. The importer resolves species, seed-pod type, commodity reward table, yield bounds, XP, tool and respawn duration into the shared world projection. `ExplorationService` independently validates the authored target, authenticated player, completed onboarding, current persisted Area/revision, tool ownership/equipment and reach. Normal seed inventory, the existing Harvesting checkpoint and lifecycle revision remain the authorities.

The canonical onboarding owner row serializes each player's exploration transaction. Seed credit, XP, cooldown and fingerprinted receipt commit together in existing `player_grower_events`/seed-stack tables. Receipt retries return the original resolved yield and current projection. No migration, new persistence service or new infrastructure is required.

## 2. Personal resource decision

Cooldowns belong to the player and stable authored entity ID. Two players may gather the same plant independently; one player cannot consume the other's basic gathering opportunity. Concurrent requests by the same player yield at most one harvest per cooldown. Presence continues to use the existing Area/Layer transport.

## 3. Resource types and placements

Thirteen wild plants use supported San Pedro and Peyote species. Cross Path has one; Path 2, Path 3 and Path 4 have two each; The Basin has six, separated by more than 550 world units. Starting Spawn's controlled tutorial plant is unchanged. Cave content is geological discovery/inspection, without an invented cave species or tissue resource.

San Pedro reuses its existing approved mature bitmap. Wild Peyote uses one new 90-world-unit-wide, proportionally rendered ribbed cactus sprite, because the existing owned-plant fallback is a plain ellipse. This world-only prop does not alter owned Peyote, its global registry, any existing artwork, hit radii or authored placement. The 384 × 223 transparent lossless WebP is 103,960 bytes; the complete generated PNG, exact prompt and deterministic crop/export are retained. See `art-source/FIRST_BASIN_EXPLORATION_V1_PROMPTS.md` and `scripts/pack-basin-exploration-v1.py`. Built-in imagegen created the new source; no existing art was edited.

## 4. Seed and yield rules

Every successful pod harvest resolves 3–10 seeds uniformly with server cryptographic randomness, once per committed receipt. These are ordinary authoritative commodity seeds, plantable and transferable under existing normal rules. No tutorial reservation, unique founder identity, mutation or Shiny outcome is created by harvesting. Existing commodity planting/genetics rules apply later.

## 5. Harvesting XP

Each successful harvest adds 10 XP through the existing XP clamp and Harvesting checkpoint. Cooldown rejection and command replay add none. Tutorial reset preserves earned wild XP; tutorial material/reward provenance remains separate. No new Exploration skill, XP curve, yield bonus or skill tree is introduced.

## 6. Respawn

Cross Path respawns after 10 minutes. Other San Pedro nodes respawn after 15 minutes; Peyote uses 15 or 20 minutes as authored. The server stores absolute ready timestamps. Refresh, relogin and Area travel preserve them. The client anchors its display to server time without resource polling; recovering plants remain visible with subdued presentation and a contextual regrowth message.

## 7. Landmark architecture and reach boundary

LDtk `LandmarkRegion` rectangles discover on physical player-center entry, without click targets or blocking dialogs. Discovery timestamps persist separately from Area discovery and Travel unlocks. No landmark XP or currency is awarded. `EnvironmentalInspectable` entities record small player-owned Journal notes.

The server checks client-reported endpoints against canonical Area/revision, walkable geometry, unobstructed interaction sight, shortest reachable route and server elapsed time at the existing 245-unit movement speed with 350 ms tolerance. It rejects blocked, disconnected, stale and implausibly fast claims. Reload restores the existing authored entry and explicitly establishes a new movement-validation anchor while retaining discoveries, cooldowns and rewards.

These checks are endpoint plausibility checks, not continuous authoritative movement. Realtime movement remains client reported, and World Foundation exit proximity remains its documented deferred boundary. This milestone does not claim comprehensive movement anti-cheat.

## 8. Five Basin landmarks

| Landmark | Runtime center | Region size | Description |
| --- | --- | --- | --- |
| Entrance Grove | 1060, 1860 | 500 × 400 | A sheltered stand of cactus marks the first open ground beyond the canyon trail. |
| Mesa Shoulder | 2440, 1770 | 560 × 420 | Layers of sandstone rise above a quiet shoulder of wind-worn sand. |
| Dry Wash | 3000, 2380 | 720 × 360 | A shallow channel cut through the basin by storms that rarely come gently. |
| Cairn | 3680, 2140 | 400 × 360 | A small stack of trail stones offers a steady point in the wide basin. |
| Eastern Ridge | 4860, 2500 | 640 × 400 | Cactus and fallen stone gather beneath the basin's eastern rise. |

Regions follow the accepted visual features. Mesa Shoulder includes clear ground beside the existing solid pillar. Neither the pillar nor its collision moves.

## 9. Journal

The existing Journal gains a First Basin field record: discovered name, Area, concise description, status and date. Undiscovered entries show `Unknown landmark`. Seven optional inspections add field notes; they grant no economic reward. Refresh/relogin reads the same server record.

## 10. Cave

`Seeping Stone` is a 400 × 320 discovery region centered at 1230, 650. Inspecting its existing mineral formation adds a note about the old seep. The cave remains a side branch with one exit back to Path 3. The acceptance route is Farm → Cross Path → Path 3 → Basin Cave → **Path 3** → Path 4 → The Basin.

## 11. Optional NPCs

No NPC was added. The milestone uses the accepted environment without expanding its roster or changing Mara.

## 12. Optional quest

No optional quest was added. The existing tutorial quest architecture remains unchanged; a field survey is the recommended small followup.

## 13. Minimap

The existing minimap is unchanged. It exposes neither wild-resource locations nor landmark names/icons. Player, terrain, collision, exits, tap-to-walk and route replacement retain their existing behavior.

## 14. Multiplayer

Rough Areas now reuse existing `RemotePlayers`, public character projection, interpolation and bounded `AreaConnection.sampleMovement`. There is no second socket, transport or presence owner. Scene teardown releases listeners and remote avatars. Personal gathering/discovery records never modify another player's state.

## 15. Dev Tools

Existing staging/local environment gates protect own-player exploration inspection and two bounded actions: reset First Basin landmark discoveries; reset wild cooldowns. Both append revisioned receipts. They preserve seeds, XP, notes, identity and other account data. Production rejects exploration/Dev Tools routes and excludes the Dev Tools UI.

## 16. Staging Worker

Deployed only `cactigrow-staging` at `https://dev.cactigrow.com`, final version `f5fc1e92-9626-427a-a8c9-45569430bed5` at 100% (2026-10-08 03:19:16 UTC / October 7 Pacific). Task baseline staging version: `8637cfc1-6a10-4586-a377-691d691ef71c`; the first exploration deployment was `24358606-620d-4561-afa2-e22b53933dea`. The final followup replaces the plain wild-Peyote fallback with the verified new bitmap. Guarded deployment followed final `npm run build:staging` and `npm run dry-run:staging` using the existing isolated Cloudflare configuration. Production was not deployed.

The live read-only prerequisite check passed for `cactigrow_staging` / `cactigrow_staging_runtime`, including event insert, onboarding lock, seed-stack writes and lifecycle-version writes. No grants or migrations were applied. All seven anonymous probes (`/`, `/world`, `/nursery`, health, bootstrap, exploration and development exploration) returned Cloudflare Access redirects (302).

## 17. Validation

Final `npm run build` (production mode), `npm run build:staging`, `npm run lint`, `npm run check:worker`, and staging dry run passed. Vite reports the existing large-chunk warning. No dependency changes. Evidence and logs are under ignored `.wrangler/basin-exploration-work`.

| Validation | Passing executions |
| --- | ---: |
| Exploration contracts, content, reach, real PostgreSQL and presentation | 32 |
| Exploration actual Chrome/Phaser browser fixture | 1 |
| World real PostgreSQL, routing and Travel | 19 |
| Starting Experience real PostgreSQL and full Chrome flow | 29 |
| Commerce restricted PostgreSQL/API and command UI | 4 |
| Worker/JWT/social checks | 42 |
| API client / Dev Tools / menu | 24 / 7 / 8 |
| Collection / Garden / lifecycle-genetics / reconciliation | 7 / 10 / 9 / 6 |
| Navigation / minimap | 12 / 3 |
| Realtime / runtime / admission / multiplayer client / chat | 45 / 17 / 9 / 9 / 12 |
| Characters / settlement / Basin environment | 14 / 9 / 13 |
| Full existing world Chrome browser regression | 1 |

These 342 executions passed without skips, failures or cancellations; counts include suite overlap. Idle PostgreSQL test handles required `--test-force-exit` for final commerce/world/Starting runs; the assertions and browser workloads actually ran. The exploration command includes this flag directly.

The focused matrix covers all 20 requested cases: valid rewards and once-only XP; tool/onboarding rejection; persisted cooldown/respawn; reload/receipt replay; same-player concurrency and independent-player harvesting; tutorial reservation separation; ordinary seed stacks; persistent/repeated/isolated landmark discovery; Journal hiding/revealing names; no minimap resource/name leakage; cave inspection; compatibility knife ownership with explicit equip; rough-Area presence/render/cleanup; Cross Path tutorial gates; blocked Path 5; Shop/Marketplace/Collection regressions; and production API/UI gates.

Browser fixture evidence is `.wrangler/exploration-browser/result.json`, `mobile-harvest.png`, `mobile-journal.png`, and `mobile-peyote.png`. It verifies real Phaser click/tap/E approaches, 390px touch harvesting, 320px Journal layout, nonblocking discovery feedback, no horizontal overflow, failed-command and initial-entry retries retaining command IDs, one session restoration, no request storm on Area revision, remote rendering/sampling/cleanup, cave notes and the actual Peyote bitmap's nonflat RGBA/proportions/foot. Its API responses are controlled fixtures, not live authentication proof.

Full existing world browser evidence `.wrangler/world-browser/result.json` verifies 26 physical transitions, 960 character poses, 80 protected-eye checks, click gait/arrival/idle, rapid destination replacement, six minimap runs, remote appearances, listener teardown, Path 5 blocking and one-row mobile HUD at 320/360/390px.

Preservation audit: the complete original parsed LDtk project matches HEAD after removing exactly 26 new entities, two new definitions, eight appended optional wild fields and the entity UID counter change. All 11 original Levels, original global definitions, art, IntGrid, topology, exits and spawns are preserved. All 128 tracked assets remain byte-identical to the task snapshot. Saved LDtk passes the official 1.5.3 schema; recipe simulation reproduces its bytes; generated WORLD matches the importer and source hash `1d78926d85224e90`.

## 18. Live acceptance

Authenticated live Chrome acceptance completed with Staging Tester 2. Baseline Inventory had an equipped Field Knife, 10 Harvesting XP and no ordinary seed stacks. Actual game clicks/minimap walking followed Farm → Cross Path → Path 3 → Basin Cave → Path 3 → Path 4 → The Basin, using unchanged physical exits. The cave's Seeping Stone was discovered and its Mineral Formation inspection recorded the actual flavor note.

Three wild harvests granted Cross Path San Pedro +9, Path 3 Peyote +6, and Path 4 San Pedro +3. Inventory showed **12 ordinary San Pedro seeds, 6 ordinary Peyote seeds and 40 Harvesting XP**, with the Field Knife still equipped and the separate demonstration bred seed preserved. A repeated Cross Path harvest produced the server recovery message without reward.

Physically reaching the five Basin regions produced compact discovery feedback; Journal showed all five names/descriptions/status/dates plus Seeping Stone (**6/6**) and the cave note. Map walking continued normally, with no resource/landmark labels. Normal Travel to Town, Town → Path 2 → Cross Path walking and a second Path 3 visit passed. Path 5 still stopped at the original blocked edge and displayed exactly `Route under construction.`

After the final bitmap release, authenticated refresh loaded the matching built bundle (`index-BEK3-uWi.js`). The corrected Peyote was visually checked in live staging; its personal regrowth presentation and server cooldown rejection persisted across refresh and travel. Inventory remained 12 / 6 seeds and 40 XP. Returning to Farm and reopening Journal retained all six discoveries and the cave note. The account was left on Farm; no reset controls, tutorial actions or economic spending were used during this acceptance.

Live 390 × 844 checks passed readable Journal scrolling, readable plant/cooldown feedback, usable minimap, no horizontal overflow (390 client/scroll width), and all seven HUD controls in one row (top 8 / bottom 52). Normal desktop viewport was restored. Live screenshots under `.wrangler/basin-exploration-work`: `live-mobile-journal.jpg`, `live-mobile-peyote.jpg`, `live-mobile-inventory.jpg`, `live-mobile-path5.jpg`, and `live-final-journal.jpg`.

Remaining human/manual acceptance: paired live accounts approaching the same node and seeing each other; physical iPhone/Safari and real-device performance; protected logout/OTP sign-in persistence; elapsed live respawn. Real PostgreSQL tests cover personal two-player isolation, concurrency, reload and elapsed respawn; actual browser fixtures cover two rendered players and touch. Those are distinct from paired live/physical-device proof. Endpoint reach validation retains the movement-authority limitation described in section 7. Human visual approval of the new sprite/content remains the user's review step.

## 19. Files changed

47 task paths: 23 existing files modified (including this milestone's context appendix), 24 new files. No files deleted.

| Responsibility | Paths |
| --- | --- |
| Authored content/import | `world/cactigrow-world.ldtk`, `scripts/world-import.ts`, `scripts/basin-exploration-v1.mjs` |
| Shared world projection/preservation | `shared/world/types.ts`, `generatedWorld.ts`, `world.test.ts`, `settlement.test.ts`, `basinEnvironment.test.mjs`, `basinExploration.test.mjs`, `explorationTestHelpers.ts` (all under `shared/world/`) |
| API contract | `shared/api/explorationV1.ts`, `shared/api/explorationV1.test.ts` |
| Server | `server/api/router.ts`; `server/exploration/ExplorationService.ts`, `explorationState.ts`, `explorationReach.ts`, `explorationReach.test.ts`, `exploration.integration.test.mjs`; `server/starting/StartingExperienceService.ts`, `StartingResetService.ts` |
| Client projection/API | `src/app/GameSession.tsx`, `src/services/api/CactiGrowApiClient.ts`, `src/features/starting/StartingContext.ts`, `StartingProvider.tsx` |
| Exploration UI/presentation/tests | `src/features/exploration/ExplorationContext.ts`, `ExplorationProvider.tsx`, `ExplorationNotice.tsx`, `ExplorationJournal.tsx`, `ExplorationDevInspection.tsx`, `explorationPresentation.ts`, `explorationPresentation.test.ts`, `exploration.browser.test.mjs`, `exploration.css` |
| Scene integration | `src/game-world/AreaExitController.ts`, `LdtkAreaScene.ts`, `LdtkWorldPage.tsx`, `PlantWorldVisual.ts`; `src/features/plants/plantVisualModel.ts` |
| Existing surfaces | `src/features/journal/FieldJournalPage.tsx`, `src/features/devtools/DevToolsPanel.tsx` |
| New wild-only art/provenance/export | `public/assets/world/props/wild-peyote-v01.webp`, `art-source/world/first-basin-exploration/wild-peyote-source-v01.png`, `art-source/FIRST_BASIN_EXPLORATION_V1_PROMPTS.md`, `scripts/pack-basin-exploration-v1.py` |
| Scripts/docs | `package.json`, `PROJECT_CONTEXT.md`, `docs/FIRST_BASIN_EXPLORATION_V1.md` |

Unqualified filenames in a row share the immediately preceding directory. `PlantWorldVisual`/`plantVisualModel` changes narrow the input type to fields already consumed, without changing owned-plant rendering. Existing preservation tests allow only the explicitly added exploration content. `package.json` adds the two focused test commands. Ignored `.wrangler` evidence is not part of the source inventory.

## 20. Commit and push

No commit, push or index staging. Preserve `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md` and `local-ai-benchmark-report.txt` unchanged and outside this milestone.

Final audit retained HEAD `e55e77a1bcaef0fca8a599ac11bc87dce055d1df` on `main`, empty staged diff, 655 unaffected tracked snapshot paths, all 128 prior art hashes and all three exclusion hashes. Local HEAD/cached `origin/main` divergence is 0/0. The entire original 156,972-byte `PROJECT_CONTEXT.md` prefix is preserved before the new appendix. `git diff --check` passes. Evidence: `.wrangler/basin-exploration-work/final-audit.json`.

## 21. Deferred systems

Unique wild founder genetics, rare harvest rolls, samples/extracts, tool durability, yield bonuses, shared depletion, landmark minimap markers, NPCs, optional quest, combat, crafting and later Zones are deferred. Existing Research/breeding remains available through ordinary cultivated finds. Path 5 remains blocked and says exactly `Route under construction.`

## 22. Recommended next milestone

After accepting this content loop, add one optional First Basin Field Survey using the existing quest architecture. Close the documented movement/proximity authority boundary before introducing scarce or rare tradable wild founder rewards.


## 23. Accepted development checkpoint - 2026-10-08

The user accepts the current staging world/content baseline, including First Basin Exploration V1 and its new wild Peyote sprite/content, as a development checkpoint and explicitly authorizes commit and push to main. This supersedes the historical commit/push and human content-review holds recorded in this implementation report. Earlier accepted milestones remain included through checkpoint `e55e77a1bcaef0fca8a599ac11bc87dce055d1df`; this checkpoint includes the exploration source, assets, authored LDtk changes, tests and documentation.

The remaining manual checks and endpoint movement-authority limitation above are retained. This git checkpoint performs no deployment or production database/configuration change; production remains on the existing stable baseline. The three named unrelated untracked exclusions remain unchanged and outside the commit. Final commit/push and synchronization results are reported separately after those git operations complete.
