# Starting Experience V1 — staging milestone

Builds on accepted World Foundation checkpoint `2734a33878442e81fa2026988cc967e8e68914ca`. Production deployment is not authorized. This document records implementation and automated acceptance; fresh authenticated live staging acceptance is separately required.

## Architecture and authored content

- LDtk remains authoritative for topology, full-opening exits, entries, runtime scaling, discovery and Travel. Existing level dimensions, custom fields, collision grids, spawns and exits are semantically unchanged.
- Starting Spawn, Path 1 and Cross Path have LDtk `Ground` and `Decorations` tile layers. IntGrid supplies collision independently; visual tiles never change navigation. The importer validates tileset paths, source bounds, flips and runtime placement.
- `StartingDesertV1` references `public/assets/world/starting/desert-tiles-v01.png`. The unmodified generated atlas is 1254 × 1254, with 16 tiles on a 313-pixel grid. Phaser samples each tile with a two-pixel inset to exclude painted atlas dividers. Existing approved San Pedro artwork supplies the wild cactus and tutorial plant stages, preserving aspect ratio.
- Authored `TutorialNpc` (`mara-guide`) and `HarvestablePlant` (`first-san-pedro`) are in Starting Spawn. `TutorialPot` (`path-1-pot`) is in Path 1. Their level coordinates use the existing topology/runtime transform.
- Click/tap targets approach through the existing NavigationController, then open a proximity interaction dialog. Keyboard movement, path replacement, automatic exits, camera bounds and locked Farm/Town registrations remain intact.

## Persistence and authority

The canonical `player_onboarding` owner row serializes onboarding, equipment and world progression. Its existing `profile_id` distinguishes genuinely new staging players (`starting-experience-v1`) from initialized/legacy players. Existing accounts and accounts with pre-existing gameplay footprints remain compatible and complete. Production initialization still uses `grower-alpha-v1`.

Revisioned `starting-experience-checkpoint-v1` entries in existing `player_grower_events` persist appearance, quest stages, equipment, Harvesting XP, the reserved seed, the pot schedule and practice identities. This extends the existing owner/event architecture without a schema migration or a second onboarding owner. Internal receipt fingerprints are excluded from client projections. `tutorial_started_at` and `tutorial_completed_at` retain server timestamps.

The staging/test-only `/api/v1/me/starting-experience` route authenticates the player, validates exact command shapes, and never accepts actor IDs, XP, yield, genetics or completion flags from the client. Harvest and pot commands validate the player's persisted current Area and the LDtk-authored target. Client proximity controls presentation, following the accepted world architecture; persistent world checkpoints are entries, not a continuous authoritative movement stream. Once-per-player target/quest state plus owner locking prevents repeated harvest rewards. Command IDs bind retries to the original request.

Appearance is three skin tones and three shirt palettes using the existing silhouette. No hair, hats or body sprites are advertised. Name setup precedes appearance setup. Farm, Town and LDtk scenes share the existing PlayerCharacter registration. Trusted staging realtime tickets carry only saved palette indices; presence/socket validation accepts that projection while preserving legacy placeholder/checkpoint compatibility. Other current Town multiplayer avatars use the same renderer. Equipment and private quest data never enter public presence.

Equipment has TOOL plus reserved Head/Body/Accessory slots. Mara grants one Field Knife; Inventory equips/unequips the owned tool through the server. Harvesting uses the existing XP level curve, with a controlled 10 XP tutorial award. Skills and Inventory show persisted Harvesting progress in staging; existing Cultivation/Breeding/Genetics columns, public total-level calculations and unlock rules are unchanged.

## Playable lessons

1. Choose name and appearance; enter Starting Spawn rather than Farm.
2. Talk to Mara for controls and the Field Knife. Equip it in existing Inventory.
3. Harvest the authored wild San Pedro once: two ordinary San Pedro seeds and one reserved tutorial seed, plus 10 Harvesting XP. The reservation cannot be spent through normal Nursery/trade commands.
4. Follow the eastern opening to Path 1; use its dedicated tutorial pot. The server creates a real specimen/clone line with the actual commodity baseline and no rare variants. The pot uses `starting-pot-45s-v1`, with `readyAt = plantedAt + 45 seconds`. It does not occupy a Nursery bed or alter normal growth rules. Existing San Pedro stages visibly show growth; the server rejects early collection.
5. Collect the pot once. The authored Path 1 → Cross Path exit records Starting Zone completion. That first exit requires the collected plant; later re-entry remains available.
6. Physically enter the player's own Farm from Cross Path. Existing discovery unlocks Farm Travel; the Farm lesson begins only on this visit.
7. Plant any normal seed in the real Nursery. The server confirms a real occupancy. Existing two-minute staging timing and normal production species schedules remain unchanged, including offline growth.
8. Visit Garden/Collection, inspect the individual tutorial specimen, and Favorite it using the existing Garden service. The server verifies the persisted Favorite before advancing. There is no forced sale or trade.
9. Visit the Genetics Lab and perform the real `observe-specimen` action. Existing GrowerAlphaService/GeneticsResearch records visible knowledge and meaningful Genetics XP. It does not grant fake knowledge or bypass higher-tier research unlocks. Previously completed legitimate observation also satisfies the lesson.
10. Select the two mature compatible San Pedro practice parents. The real PlantLifecycleService/createBredSeed resolves one offspring using normal inheritance and variant rules, awarding normal one-time Breeding XP. A retry returns the same seed; a new command cannot produce another practice offspring. Completion and offspring identity persist.

## Practice material safety

`clone_lines.origin_type = starting-experience-tutorial` marks both practice specimens and the offspring line. One parent is the legitimately grown/collected pot specimen; the second is issued once after Collection. Both use `establishCommoditySeedGenetics`, not invented tutorial genetics. Collection labels the specimens as tutorial practice.

The shared transfer eligibility check rejects tutorial specimen NPC sale, listing and Mail transfer regardless of Favorite state. Tutorial specimens cannot produce tissue samples. They can perform normal bounded research milestones. Normal breeding accepts the designated practice pair only at the correct Farm stage and only once. Its offspring demonstrates real inherited genetics but cannot be planted to generate economic descendants. Equipment Inventory labels the practice offspring explicitly. No currency reward, rare-parent grant, crafting or durability is introduced.

Normal systems remain usable through existing progression rules; the tutorial does not permanently lock Nursery, Collection, Lab or Breeding. The only introductory route gate is the first Starting Zone exit.

## Development tools and presentation

Existing Dev Tools has a read-only Starting Experience inspection: compatibility, appearance, stages, tool, Harvesting XP and pot ready timestamp. No destructive reset, repeat-reward tool or full-account wipe is added. Existing production Dev Tools gating remains intact.

HUD Travel clears the previous tutorial dialog and its movement pause before switching Areas; the browser regression verifies normal movement afterward. The compact objective can collapse; it stays below the single-row HUD and disappears after Farm completion. Dialogs use the existing modal focus utility, readable copy and 44-pixel buttons. Inventory is extended rather than creating another menu. Normal gameplay retains the small location indicator; giant LDtk labels and debug triggers remain explicitly debug-gated. Future blocked routes still say “Route under construction.”

## Verification and live acceptance

`npm run test:starting` runs strict contract/importer/public-presence checks and a real PostgreSQL progression test. Set `CACTIGROW_EMBEDDED_POSTGRES_MODULE` to an installed embedded-postgres module. Set `CACTIGROW_TEST_BROWSER_EXECUTABLE` to an existing Chromium executable to also exercise the full application through actual APIs/services/PostgreSQL: name, appearance, Mara/tool/equipment, harvest, authored exits, pot growth/collection, refresh, Farm discovery, normal Nursery, persisted Favorite, real research, real breeding and completion.

The browser fixture checks 320/360/390-pixel appearance/world layouts, no horizontal overflow, one-row HUD and objective/HUD separation. It uses an isolated test identity and database, never a shipped authentication bypass. It verifies refresh persistence; server projection tests also recreate service instances. It does not replace a real Cloudflare Access logout/login test or a physical-phone acceptance run.

Regression evidence includes real Phaser world walk-through; world/PostgreSQL transitions and Farm isolation; navigation; commodity/bred-seed genetics and normal growth; commerce/Shop/Marketplace; Garden/Collection; client reconciliation; Worker authentication; realtime/DO admission and hibernation; Local/Town/World chat; and production Dev Tools exclusion. Build/typecheck/lint outcomes and release identifiers belong in the release record below.

The current read-only staging preflight confirmed `cactigrow_staging`, `cactigrow_staging_runtime` and the required existing table privileges. No migration, grant, Access, DNS, production binding or owner-role modification is required.

### Release record

- World source version: `9b39bdae943d6c63`.
- Staging Worker: `c5f12f81-c69a-4d4f-958d-7fccde905dca`, deployed at 100% on `dev.cactigrow.com`, replacing `21c1eba7-67f7-4495-b2ef-521edd6ac286`. This milestone supersedes accepted World Foundation Worker `8a14837a-0d19-4509-9386-b549a61dc9ee`. Existing isolated Hyperdrive and AreaPresence bindings are unchanged. Source commit: `03c9a47944d447dba3c5731da762f0f5f12e9e69`.
- Fresh live staging account: pending an approved fresh Cloudflare Access identity. The established account must remain compatibility-complete and must not be reset for acceptance.
- Full automated fresh-player application flow: 16/16 passed against isolated PostgreSQL and Chromium, including visible growth stages, refresh recovery, complete Farm lessons, mobile HUD, actual MailService rejection and Travel-from-dialog followed by normal Farm movement. The final full suite has zero failures or skips.
- Physical-phone and actual protected-staging logout/login acceptance: pending.
- Implementation commits: `15ad63a44efad62a5daabb3754b222da712289e3` (LDtk visuals/entities), `cf142d567883d29ab734113c9805a7c217350f14` (server authority/persistence), `1d53cd234da57f345c06ae02d3f79d39e9e23af0` (gameplay/UI/tests). Compatibility dialog polish: `924bec42845989170f8e7d59728d6e954edbd517`. Legacy realtime appearance fallback: `f45822a8241020fab2eb7db37797bc7af1307135`. Travel/dialog lifecycle fix and browser regression: `03c9a47944d447dba3c5731da762f0f5f12e9e69`. A separate documentation commit records deployment and acceptance.
- Push: not performed for this milestone. The earlier World Foundation checkpoint is already on origin/main; the new logical commits remain local pending an explicit push instruction. No half-complete milestone or production release was pushed.

Builds for production exclusion and staging, TypeScript project build, Worker typecheck, lint, official LDtk JSON schema validation (zero errors), staging dry run and diff checks passed. Existing Vite chunk-size notices are warnings. Regression commands passed: `test:world` (17), `test:world:browser` (actual Phaser walkthrough), `test:navigation`, `test:client`, `test:collection`, `test:garden`, `test:e1`, `test:commerce` (4 with actual PostgreSQL), `test:devtools` (6), `test:worker` (42), `test:reconciliation` (6), `test:chat` (12), `test:realtime`, `test:realtime:runtime` (17) and `test:realtime:admission` (9). These results do not claim an authenticated fresh-account live run.

Anonymous staging `/`, `/nursery`, health, V1/V2 bootstrap, V3 lifecycle and Starting Experience requests all return 302 to the existing Access team domain. This verifies the protection layer, not authenticated app health. Deployment history confirms 100% traffic on the new version. No schema, grant, data maintenance, Access, DNS, secrets or production change occurred.

### Authenticated live staging evidence

The existing Staging Tester account loaded without character creation or forced tutorial, retaining level 35 and $11,022. Dev Tools showed compatibility=true, both stages complete, no tool, zero Harvesting XP and an unplanted pot. No rewards or reset were granted. Normal movement passed Farm -> Cross Path -> Path 1 -> Starting Spawn. All three developed Areas rendered terrain; the dedicated pot, Mara and approved wild San Pedro were visible without giant LDtk/debug labels. Mara showed the completed-account explanation and no reward control.

Worker `21c1eba7-67f7-4495-b2ef-521edd6ac286` restored Starting Spawn after a fresh acceptance URL. Existing discovered Town/Farm Travel remained available. Town -> Path 2 -> Town physical movement passed; chat showed World - The First Basin and Local - Town. Two-account message delivery is not claimed. The account was returned to its own Farm through existing Travel. Final Worker c5f12f81-c69a-4d4f-958d-7fccde905dca subsequently restored that Farm with the same level/currency and no forced onboarding; the final dialog-Travel behavior is separately covered by the complete automated browser test. The full multi-Area Phaser regression separately exercises both physical directions and movement/camera geometry.

Local live screenshots remain ignored: `.wrangler/starting-browser/live-compatibility.png`, `live-cross-path.png`, `live-path-1.png`, `live-starting-final.png`, `live-mara-compatibility.png`, `live-town-path-2.png`. Automated fresh-player screenshots and `acceptance.json` are in the same folder. Fresh protected-staging onboarding, actual logout/login during that tutorial, and a physical phone are not verified. An approved fresh Access account is required to complete them; the established account was deliberately preserved.

## Required milestone report

| # | Requested item | Result |
|---|---|---|
| 1 | World art / tilesets | LDtk Ground and Decorations, validated importer, bundled PNG and Phaser tile sampling; independent IntGrid collision. |
| 2 | Starting Spawn art | Sand/dirt/rocks/vegetation with Mara and the approved cactus asset; initial staging art. |
| 3 | Path 1 art | Authored terrain, dedicated terracotta pot and visible approved growth-stage art. Cross Path also receives terrain. |
| 4 | Character options | Three skin tones and three shirt palettes on the existing silhouette. |
| 5 | Appearance persistence | Server event checkpoint; local Farm/Town/LDtk and supported Town multiplayer rendering. Legacy avatar fallback preserved. |
| 6 | Equipment model | Owned Field Knife and persistent TOOL slot; reserved Head/Body/Accessory slots. |
| 7 | Tutorial tool | Mara grants once; Inventory equips/unequips through server commands. |
| 8 | Harvesting | 10 XP once from valid harvesting; existing level curve; Skills/Inventory projection. |
| 9 | Harvestables | LDtk HarvestablePlant with stable ID/species/yield/once-per-player state; current Area and equipped tool validated. |
| 10 | NPC/dialogue | Mara uses existing character renderer, click/tap approach and existing modal focus conventions; concise stages. |
| 11 | Quest persistence | Canonical onboarding owner plus revisioned existing grower events; no migration. |
| 12 | Path 1 planting | Reserved real seed material creates one real specimen, outside Nursery occupancy. |
| 13 | Accelerated growth | Explicit 45-second server schedule; normal Farm growth untouched; early collection rejected. |
| 14 | Starting Zone completion | Recorded transactionally on authored Path 1 to Cross Path exit; re-entry remains possible. |
| 15 | First Farm visit | Physical own-Farm arrival begins lessons and existing discovery unlocks Travel. |
| 16 | Nursery | Real normal seed planting and persisted occupancy; offline/normal timing explained. |
| 17 | Garden/Collection | Real specimen identity and persisted Favorite; no forced transfer. |
| 18 | Genetics/Research | Actual observe-specimen service creates player knowledge and meaningful Genetics XP. |
| 19 | Breeding | Explicit selection of two compatible parents; actual inheritance service produces one practice offspring. |
| 20 | Safe materials | Real baseline genetics, tutorial origins, sale/list/Mail/sample protections and unplantable practice offspring. |
| 21 | Existing accounts | Compatibility-complete; no appearance/tutorial forced reset or repeated rewards. |
| 22 | Dev Tools | Read-only state/gear/Harvesting/pot inspection, existing production exclusion. |
| 23 | Staging Worker | c5f12f81-c69a-4d4f-958d-7fccde905dca at 100%; production untouched. |
| 24 | Fresh live acceptance | Pending approved fresh Access identity; full isolated fresh-player application flow passed. |
| 25 | Validation | Builds, lint, client/Worker types, focused PostgreSQL/browser tests and affected regressions pass; details above. |
| 26 | Files changed | Exact inventory below, plus PROJECT_CONTEXT.md and this report. |
| 27 | Commits | Six separate implementation/polish commits above, plus documentation record. |
| 28 | Push | New commits local; no new push performed. |
| 29 | Deferred work | Listed below; no expanded RPG/economy/deeper Area scope. |
| 30 | Production blockers | Explicit promotion approval, fresh protected-staging flow/relogin, physical mobile acceptance and production onboarding enablement review. |

## Intentionally deferred / production blockers

Final art for deeper Areas; additional character assets; armor/stats/durability/crafting; harvest yield balance/rare finds/respawn; advanced genetics lessons; destructive tutorial resets; public Harvesting total-level integration; broader continuous server movement validation. These are not implemented or represented as finished V1 features.

Before production consideration: explicit production authorization, fresh protected-staging full-flow and logout/login acceptance, physical mobile acceptance, and separate approval to enable Starting Experience for production-created accounts. This milestone does not change current production initialization or deploy production.

## Terrain generation provenance

Built-in imagegen was used after inspecting the repository's existing assets; no usable terrain atlas existed there. Saved project asset: `public/assets/world/starting/desert-tiles-v01.png`. Existing buildings and plants were not edited. This new terrain is staging art, not a newly human-locked asset. Atlas blending/seams and landscape composition still need human visual review; V1 establishes authored visual support rather than claiming final polished terrain.

Final prompt:

> Use case: stylized-concept. Asset type: game desert terrain tileset atlas for CactiGrow LDtk. Create one square 1024x1024 raster atlas laid out as EXACTLY 4 columns by 4 rows, each equal 256x256 cell, no margins or gaps and no grid lines or text. Hand-painted stylized 3D semi-cartoon warm tactile desert game, soft overhead sun, muted ochre sand, brown packed earth, terracotta canyon stones, olive dry scrub. This is a terrain atlas, NOT a scene. Each cell is an independently tileable top-down ground square, with subdued edge-neutral matching sand boundaries. Row1: four varied sand floor tiles with tiny sand grain and quiet pebbles. Row2: four packed dirt path tiles, all full-cell ground, same edge color as sand, subtle footprints/earth in middle. Row3: four rock-edge terrain patches on sand: soft rounded ochre rocks packed near middle, small low stone clusters, canyon stones, dry rocky soil. Row4: four desert decoration patches on matching sand: dry grass tufts, small green cactus, low bush, rounded terracotta stones. Keep motifs modest and readable at game scale, smooth detailed painterly non-pixel-art, no buildings, no character, no letters, no black placeholder areas. Atlas must fill the whole square precisely with 16 equal square cells.

The returned raster was 1254 × 1254; the original file is preserved and the LDtk metadata uses its actual dimensions.


## Exact file inventory

```text
PROJECT_CONTEXT.md
docs/STARTING_EXPERIENCE_V1.md
package.json
public/assets/world/starting/desert-tiles-v01.png
scripts/world-import.ts
server/api/router.ts
server/auth/authentication.ts
server/gameplay/GrowerAlphaService.ts
server/gameplay/PlantLifecycleService.ts
server/gameplay/specimenCommerceEligibility.ts
server/realtime/AreaCoordinator.ts
server/realtime/admissionRoutes.ts
server/realtime/presenceState.ts
server/realtime/runtimeContracts.ts
server/staging/initializeGrower.ts
server/starting/StartingExperienceService.ts
server/starting/starting.integration.test.mjs
server/starting/startingState.ts
server/starting/startingUiAcceptance.mjs
server/world/WorldService.ts
shared/api/startingExperienceV1.test.ts
shared/api/startingExperienceV1.ts
shared/realtime/protocolV1.ts
shared/world/generatedWorld.ts
shared/world/types.ts
src/app/DeploymentAccessBoundary.tsx
src/app/GameSession.tsx
src/features/devtools/DevToolsPanel.tsx
src/features/garden/ServerGardenPage.tsx
src/features/inventory/InventoryPage.tsx
src/features/progression/SkillsPage.tsx
src/features/progression/skillDefinitions.ts
src/features/starting/AppearanceSetup.tsx
src/features/starting/EquipmentInventory.tsx
src/features/starting/StartingContext.ts
src/features/starting/StartingDevInspection.tsx
src/features/starting/StartingObjective.tsx
src/features/starting/StartingProvider.tsx
src/features/starting/WorldTutorialDialog.tsx
src/features/starting/starting.css
src/game-world/AreaExitController.ts
src/game-world/FarmTestScene.ts
src/game-world/LdtkAreaScene.ts
src/game-world/LdtkWorldPage.tsx
src/game-world/PlayerCharacter.ts
src/game-world/TownTestScene.ts
src/services/api/CactiGrowApiClient.ts
world/cactigrow-world.ldtk
```

Preserved and excluded: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, `local-ai-benchmark-report.txt`. Local screenshots, disposable database artifacts, generated test bundles and deployment logs remain ignored under `.wrangler/` or `node_modules/.tmp/`.
