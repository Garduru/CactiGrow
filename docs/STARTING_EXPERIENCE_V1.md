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
7. Plant any normal seed in the real Nursery. A real plantSeed transaction after the current Farm arrival advances the lesson automatically; old occupied beds do not satisfy a reset. Existing two-minute staging timing and normal production species schedules remain unchanged, including offline growth.
8. Visit Garden/Collection, inspect the individual tutorial specimen, and Favorite it using the existing Garden service. The server verifies the persisted Favorite before advancing. There is no forced sale or trade.
9. Learn about facilities/unlocks in Genetics Lab, then open Garden / specimen Details / Study Genetics / Observe specimen (Basic Observation). Existing GrowerAlphaService/GeneticsResearch records visible knowledge and meaningful Genetics XP. It does not grant fake knowledge or bypass higher-tier research unlocks. Previously completed legitimate observation also satisfies the lesson.
10. Select the two mature compatible San Pedro practice parents. The real PlantLifecycleService/createBredSeed resolves one offspring using normal inheritance and variant rules, awarding normal one-time Breeding XP. A retry returns the same seed; a new command cannot produce another practice offspring. Completion and offspring identity persist.

## Practice material safety

`clone_lines.origin_type = starting-experience-tutorial` marks both practice specimens and the offspring line. One parent is the legitimately grown/collected pot specimen; the second is issued once after Collection. Both use `establishCommoditySeedGenetics`, not invented tutorial genetics. Collection labels the specimens as tutorial practice.

The shared transfer eligibility check rejects tutorial specimen NPC sale, listing and Mail transfer regardless of Favorite state. Tutorial specimens cannot produce tissue samples. They can perform normal bounded research milestones. Normal breeding accepts the designated practice pair only at the correct Farm stage and only once. Its offspring demonstrates real inherited genetics but cannot be planted to generate economic descendants. Equipment Inventory labels the practice offspring explicitly. No currency reward, rare-parent grant, crafting or durability is introduced.

Normal systems remain usable through existing progression rules; the tutorial does not permanently lock Nursery, Collection, Lab or Breeding. The only introductory route gate is the first Starting Zone exit.

## Development tools and presentation

Existing Dev Tools has a read-only Starting Experience inspection: compatibility, appearance, stages, tool, Harvesting XP and pot ready timestamp. The separately authorized reset extension below adds a confirmed tutorial reset; a full-account wipe remains unavailable. Existing production Dev Tools gating remains intact.

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


## Visual collision boundary / rock edge pass ? 2026-10-06

The initial hand-placed Decorations did not follow IntGrid. Once a visual layer existed, the normal renderer made the static collision rectangles transparent. Sand therefore appeared open at accepted collision walls. This pass changes presentation only.

LDtk now has a BoundaryEdges AutoLayer (16 topology units), sourced from IntGrid UID 1. Its single active rule matches value 1 and stamps existing StartingDesertV1 rock tile 10. Starting Spawn, Path 1 and Cross Path opt in; Path 5 receives only boundary/barrier treatment. No new atlas or unrelated artwork is introduced. The saved autoLayerTiles are editor cache, not another boundary authority: the importer re-evaluates this explicitly supported one-cell rule from current IntGrid, rejecting unsupported rule settings. The existing atlas-to-cell projection renders at 64 runtime units in Starting Spawn and 80 in the other Areas, preserving normalized scale.

The importer also derives a narrow outer rock rim from the accepted Level/runtime world bounds where IntGrid has no rock cell. All intersecting unblocked AreaExit openings are reserved. IntGrid wall corners that already overlap a larger trigger remain visible; its actual navigable lanes stay open. Farm and Town never opt in and retain their complete registered geometry. A future-route rock barrier is derived from the blocked AreaExit, placed just beyond its trigger in the direction away from the authored entrance. It adds no collider, and approaching the existing trigger still shows ?Route under construction.?

BoundaryEdges renders after Ground/Decorations. Explicit staging worldDebug draws translucent red IntGrid rectangles above the art for comparison; normal gameplay has no collision markers. NavigationMap, Arcade bodies, movement, exit controllers, camera and tutorial entities are unchanged.

Verification: focused coverage tests check every blocked grid cell, outer-bound rims, clear navigable exit lanes, stale editor-cache independence and Path 5 barrier/message. Semantic comparison against the prior commit confirms all 11 Level metadata and every existing layer/entity/IntGrid unchanged. Official LDtk schema validates with zero errors. World/Starting/browser/navigation/build/lint/Worker results and live staging evidence follow in the final record.

Changed files: world/cactigrow-world.ldtk; scripts/world-import.ts; shared/world/types.ts; shared/world/generatedWorld.ts; shared/world/world.test.ts; shared/api/startingExperienceV1.test.ts; src/game-world/LdtkAreaScene.ts; src/game-world/world.browser.test.mjs; PROJECT_CONTEXT.md; this document. Unrelated untracked files remain preserved. No commit/push or production deployment is part of this pass.


Boundary release: world hash 49b3fa3a69ab74a9; staging Worker 1813a848-b684-4fd9-9e25-4bece026f9e0 at 100%, replacing c5f12f81-c69a-4d4f-958d-7fccde905dca. Guarded staging wrapper used, existing bindings unchanged. Anonymous world/health/bootstrap probes retain the existing Access redirect. World tests 18/18 with disposable PostgreSQL; Starting tests 16/16 with real PostgreSQL/full fresh-player Chromium flow; navigation 12/12; actual Phaser walkthrough passes 26 physical transitions, exact spawn/trigger counts, body/camera scale, normal rock tile counts, blocked message and explicit debug collision overlays. Builds, lint, Worker types, official schema, dry run and diff checks pass. The first browser run exposed a debug-recreation readiness race in the test; waiting for the requested debug flag fixes it, and the complete rerun passes without skips. No runtime lifecycle change was needed.


Authenticated Brave staging checks: sampled northern/western/southern/eastern Starting Spawn collision stops now have visible rocks; Path 1's sloping/long northern and southern corridor stops have rock borders. Normal movement/pathfinding stopped at those accepted boundaries. The live Starting Spawn -> Path 1 -> Cross Path -> Path 3 -> Path 5 sequence passed. Red worldDebug outlines aligned with IntGrid rock tiles in Starting Spawn/Path 1 and left the authored opening clear; debug was removed for normal traversal. The tutorial NPC, harvest target and pot remain visible at their unchanged positions. Path 5's rock cap was visible before approach; the existing trigger showed exactly ?Route under construction.? without changing Area. Farm Travel remains available; the established account was returned to its own Farm with level 35 and $11,022 unchanged. Full tile coverage is automated; this is sampled desktop perimeter acceptance, not a physical-phone or human final-art approval claim.

Ignored live evidence: .wrangler/world-work/rock-live-starting-west.png; rock-live-starting-south.png; rock-live-starting-debug.png; rock-live-path1-debug.png; rock-live-path1-normal.png; rock-live-cross.png; rock-live-path5-blocked.png. Existing atlas seams/composition remain a separate art-polish limitation; no deeper Area terrain was finished. No production, schema, grant, Access/DNS, infrastructure or commit/push change occurred.

## Confirmed Starting Experience reset � 2026-10-06

The user authorized resetting only Staging Tester 2 (`0de86abc-e886-4870-a077-ada947bf638f`) for fresh onboarding acceptance. The existing name/profile and Auth/Access/internal identity mapping remain intact. Name setup is already satisfied; appearance setup is the first pending step.

Menu ? Other ? Developer Tools ? System now offers **Reset Starting Experience**. Enter the target internal UUID, then enter it again in the confirmation field. The authenticated `POST /api/v1/dev/starting-experience/reset` uses the existing environment gate: production/public hosts/shared remote development are excluded; local development requires the isolated loopback database. Another account requires both existing `progression.adjust` and `inventory.adjust` staff permissions, rechecked under the staff-role lock through commit. Self-reset uses authenticated ownership. The command never accepts an actor identity from the client.

The canonical onboarding owner lock serializes reset with normal tutorial/world/gameplay operations. It changes only onboarding profile/tutorial timestamps, appends an initial tutorial checkpoint at a higher revision, and appends the ordinary server initial-world checkpoint at a higher revision. `initialLocation` supplies the LDtk-authored Starting Spawn default entry and Starting Spawn discovery only, with no Farm/Town/later Travel unlocks. It increments the existing lifecycle projection version. No client teleport, account deletion, starter-package refill, migration or grant is involved.

Equipment/Harvesting XP/reserved seed/pot/practice-parent/offspring/Spawn and Farm lesson completion reset to their initial tutorial values. Normal Cultivation/Breeding/Genetics XP, currency, commodity stacks, Nursery schedules, property, achievements, botanical discoveries, permanent research and ordinary command/event/mail/social history are preserved. Practice specimens and offspring are retired from playable lifecycle projections only when their clone-line origin is `starting-experience-tutorial`; their IDs/genetics/lineage remain persisted for audit. Each reset records the complete cumulative set of owned tutorial practice IDs, so earlier runs cannot reappear after a later reset. The normal seed reward is once per account across resets: historical harvest checkpoints prevent another two-seed grant, while the reserved quest seed and tool can replay the lesson. Ordinary stacked seeds cannot be safely attributed after spending/trading, so they are preserved.

The persisted `starting-experience-reset-v1` event records actor, target UUID, prior profile/stages, revisions and retired practice IDs. Duplicate/concurrent command IDs return the original receipt and never repeat a reset, even after later tutorial progress. The Dev Tools session action log reports the exact target and result. A self-reset refreshes existing world/tutorial/lifecycle providers; another target is left for its next normal login.

Source: `server/starting/StartingResetService.ts`, `shared/api/startingResetV1.ts`, the existing API router/typed client, `StartingResetControl.tsx`, `DevToolsPanel.tsx`, Starting inspection, lifecycle projection and harvest reward service. Focused disposable PostgreSQL tests cover legacy/complete resets, ownership/staff authorization, production exclusion, exact confirmation, concurrent receipt replay, retained identities/gameplay/genetics, retired practice assets, monotonic revisions, first-time server routing, empty Travel, stale transition rejection, no repeated ordinary seed reward and late replay safety. Existing fresh full-app browser acceptance remains part of `test:starting`.

### Reset release and exact-account verification

Staging Worker **bb58a427-90d4-4057-bdd8-3d38a0b65516** is deployed at 100% on dev.cactigrow.com, replacing 1813a848-b684-4fd9-9e25-4bece026f9e0. Existing isolated Hyperdrive/Access/AreaPresence bindings remain unchanged. Source remains uncommitted; no push or production deployment was requested/performed.

The authenticated OWNER used the live Dev Tools System action with target and confirmation both exactly `0de86abc-e886-4870-a077-ada947bf638f`. Reset receipt **66d31c76-1c08-4545-80ed-621ef27744d6**, persisted at **2026-10-06T21:59:21.448Z**, records actor 47511805-24fb-4934-8fb8-bd495bc3ad55 and target Staging Tester 2. The panel and session log reported success. This target had no Starting checkpoints, tutorial practice material or world checkpoints before reset; no tutorial asset removal was necessary.

Read-only Hyperdrive inspection verified cactigrow_staging / cactigrow_staging_runtime and existing required SELECT/INSERT/UPDATE privileges. After reset, profile is starting-experience-v1; tutorial revision 1, compatibility false, appearance incomplete, spawn stage appearance, Farm stage undiscovered, both tutorial completions false, no gear, zero Harvesting XP, no pot/reserved seed/parents/offspring and null started/completed timestamps. Name/profile is preserved. World revision 1 resolves through initialLocation to Starting_Spawn_Tutorial_1, default entry (1344,704), Starting Zone, discoveredAreaIds containing Starting Spawn only and no Travel destinations. Shared runtime DTO validators and authored initial-location field comparisons pass; no tutorial command or step was performed for the live target.

Before/after row counts and content digests match for 14 preserved groups: player, profile, external identity mapping, ordinary seed stacks, Grower state (property/research/achievements/botanical discovery), Nursery, owned specimens/bred seeds, clone lines, Garden metadata/displays, ordinary receipts, Mail and ordinary grower events. Currency remains 0; Cultivation/Breeding/Genetics XP remains 35/0/70; commodity stacks remain two San Pedro and two Peyote seeds. Initialized/starter-granted timestamps are preserved. Auth identities/Access configuration are unchanged. Production, schema, migrations, grants, roles, DNS and unrelated/untracked files are untouched.

Starting tests pass 17/17, including disposable PostgreSQL reset and the full fresh-player Chromium flow; Dev Tools 7/7 and PostgreSQL/UI Dev Tools 1/1 pass. Production/staging builds, lint, client/Worker types, staging dry-run and diff checks pass. Live exact-target reset and read-only readiness pass; actual Staging Tester 2 login/tutorial remains for the user. The available Brave session still reports a blocked world-module URL (net::ERR_BLOCKED_BY_CLIENT on direct module navigation); normal Nursery and live Dev Tools work. This browser-level world rendering limitation is not a completed fresh onboarding acceptance, and no protection was disabled to bypass it. Screenshot: ignored .wrangler/world-work/reset-live-success.png.

Additional shared API regressions passed after release: Worker 42/42 and client 24/24. No further source change or deployment was needed for these checks.


## Tutorial flow correction - staging only

The earlier partial reset deliberately retained the character name. Dev Tools / System now explicitly selects tutorial (retain name) or full-onboarding (require name selection), with exact target UUID confirmation for both. A collapsed staging/development-only reset control remains reachable during appearance setup before the normal gameplay menu exists. Both use the same authenticated API and server authorization/receipt logic.

Full reset persists nameComplete=false. The stable profile/public UUID and historical profile row remain intact for Farm ownership and recovery, but the server suppresses the inactive name from Social projections until a new explicitly selected name passes the existing normal validation/uniqueness rules. SocialService serializes name selection with reset on the canonical onboarding owner and activates the checkpoint atomically. No Access email supplies a character name. The same empty CharacterNameOnboarding form precedes appearance; no migration/profile deletion/new auth account is needed. Normal account records, public UUID, social relationships, possessions, economy and durable history stay intact.

Removed tutorial confirm-nursery, confirm-garden, direct observation and duplicate parent-selection/breeding controls. Strict API validation rejects manual completion commands. Reconciliation reads actual plantSeed events after Farm arrival, persisted Favorite for the collected tutorial specimen, specimen-observed knowledge receipts, and the designated real bred-seed identity. Normal gameplay services still own planting/research/breeding/genetics and XP. Canonical owner locking and command receipts serialize one-time practice grants and reset retries. Server pot deadline advances collect-pot to collect-ready; a single client deadline refresh observes that authoritative state.

Farm sequence: physical own-Farm discovery / normal Nursery planting / Garden specimen identity and Favorite / Genetics Lab explanation / Garden Details, Study Genetics, Basic Observation / Garden Details, Breed, designated practice parent, Confirm breeding / automatic Farm completion. Lab is a facilities/progression screen; Research Log stores historical knowledge/comparisons. Visiting either never fabricates research completion. The Lab introduction is guidance rather than a fake completion gate.

Live progression invalidates on authoritative lifecycle/Grower versions and Garden projection changes, with short coalescing and no tutorial polling. Issuing the second practice parent causes one lifecycle refresh. The compact objective uses normal document flow inside facility pages, sits below HUD outdoors, collapses, scrolls internally on mobile and hides during normal specimen/research/breeding dialogs. Locked geometry, movement, camera, art and normal growth are unchanged.

Protected Access logout/login and physical phone/manual fresh-flow acceptance remain separate from disposable PostgreSQL/Chrome evidence. Staging Tester 2 remains untouched after the authorized full reset. Exact release/reset evidence follows.


### Tutorial flow correction release and untouched tester

Guarded staging Worker b051d11a-67a0-4ea1-990b-b1af4bb12f56 at 100% on dev.cactigrow.com replaces bb58a427-90d4-4057-bdd8-3d38a0b65516. Existing isolated Hyperdrive/AreaPresence/Access configuration is unchanged. World hash remains 49b3fa3a69ab74a9. No production deployment, schema, migration, grants, roles, DNS, secrets, commit or push changes.

19/19 Starting tests pass without skips, using actual disposable PostgreSQL and installed Chrome. The normal full-app fresh flow performs Nursery planting/Favorite/Basic Observation/breeding and observes objectives advance without confirmation or reload. It checks the normal Lab page cannot fabricate observation, full reset returns to the empty existing name form, valid name selection then enables appearance, reset UI requires exact UUID confirmation, replay/authorization/material safety, name/public identity persistence and legacy name-only profile compatibility. Mobile 320/360/390px appearance/world/facility overflow, HUD separation and Nursery controls remain clear; objective hides during normal research modal. Worker 42/42, Dev Tools 7/7, client 24/24, builds, production reset-UI exclusion, Worker types, lint, staging dry-run and diff checks pass. Existing Vite bundle-size and isolated PostgreSQL client-query notices are warnings.

Authenticated live Chrome performed only the explicitly authorized full reset for Staging Tester 2, internal UUID 0de86abc-e886-4870-a077-ada947bf638f, preserving public UUID c8f213b0-b73c-402b-8313-a114f12f5766. Actor is the same authenticated target (self reset). Receipt 8f108234-3288-48da-852d-5aef26d002d8 at 2026-10-07T01:45:13.366Z. Server checkpoint revision 15: nameComplete=false, appearanceComplete=false, compatibilityComplete=false, spawn/Farm incomplete, no gear/rewards/pot/active tutorial parent or offspring. World revision 6: starting-spawn-tutorial default (1344,704), Starting Zone, Starting Spawn discovered only; Farm/Town/later Travel absent. The old display-name row is inactive historical identity, not the active character projection: Social ownProfile=null until explicit normal name selection.

Read-only BEGIN READ ONLY checks verified cactigrow_staging/cactigrow_staging_runtime, required current permissions and identical count/content digests across 14 preserved groups (identity/mapping/profile, normal inventories/economy/gameplay, plants/seeds/genetics provenance, Garden metadata, Mail/receipts and ordinary events). No unrelated possessions or history were deleted. Chrome visibly shows an empty Choose your character name form, saved proof .wrangler/world-work/full-onboarding-waiting-name.png. No name, appearance or tutorial step was selected. The target is ready for user acceptance. Actual protected Access logout/login, physical phone and the user's complete revised walkthrough remain unperformed; disposable full-app Chrome evidence does not substitute for them.


## Starting Experience guidance polish (2026-10-06, staging only)

Tutorial navigation shortcuts were removed. A presentation-only target registry derives guidance from server tutorial state, route, Inventory visibility and mounted real controls. DOM targets receive a subtle outline/pulse; Phaser targets use a noninteractive overlay over existing building art bounds or authored entity/exit bounds. Geometry, navigation, camera and HUD placement are unchanged. No scene recreation is triggered by guidance changes.

The dedicated Path 1 pot uses `starting-pot-15s-v1` (15 seconds); existing 45-second checkpoints remain readable. Normal staging/production Nursery and offline growth rules are unchanged. Incomplete fresh onboarding permits only the Farm exit from Cross Path. Server validation rejects other physical exits before location/discovery persistence; existing trigger rearm prevents repeat messages while standing in an opening. Completed/compatible players remain unrestricted.

The Farm flow is normal Nursery planting, Garden favorite, actual Lab admission, Garden Details -> Study Genetics -> Observe specimen -> real breeding. `visit-lab` records only facility introduction when the authoritative world location is Farm and the stage is lab; it grants no research knowledge. Research/breeding completion still reconciles committed domain events.

Two tutorial specimens are necessary for the real two-parent breeding transaction: Your first San Pedro (grown in Path 1, observed in Garden) and Practice partner (mature compatible San Pedro). Real breeding requires mature collected owned unlisted parents of the same genus; both do not need observation. The former picker checked basic eligibility but permitted reversed tutorial order or ordinary parents that conflicted with the server's ordered tutorial pair. Guided selection now anchors the first parent and offers only the intended eligible partner, even when opened from the partner's Details. After completion ordinary breeding remains unrestricted; spent once-only practice material is excluded from normal partner choices.

No production deployment, schema/grant changes, or commit/push is authorized by this polish. Manual staging acceptance remains required before commit/push. Tester 2 must receive full onboarding reset and remain at empty name selection; reset retires practice projections and preserves account identity, normal possessions, economy and history.


Staging guidance acceptance evidence: guarded staging Worker `becab7bc-2ed3-401f-a9a3-4dbe1f71d225` is active at 100%, world hash `49b3fa3a69ab74a9`. Starting tests 24/24 (real PostgreSQL and full Chrome fixture), world 18/18, Phaser walk-through 1/1, navigation 12/12, lifecycle/breeding rules 9/9, Dev Tools 7/7, client 24/24, Worker 42/42 all passed with zero skips. Production/staging builds, client/Worker type checks, lint and diff whitespace checks passed. Production bundle contained no reset controls. Existing bundle-size and pg concurrency deprecation warnings remain.

Tester 2 (`0de86abc-e886-4870-a077-ada947bf638f`) was FULL reset through the authenticated staging Dev Tools confirmation form, receipt `eba893ad-9c60-42be-9856-764728252855` at `2026-10-07T02:19:24.367Z`. Read-only staged verification: tutorial revision 30, name/appearance/spawn/Farm incomplete, empty equipment/pot/parents/offspring, Farm undiscovered; world revision 14, Starting Spawn default (1344,704), only initial discovery and no Travel unlocks. The same stable public identity remains; own profile is hidden only while the authoritative name gate is incomplete. All 14 preserved row-count/digest groups and six economy/initialization fields matched before reset. Chrome is left at an empty name form; no tutorial steps were completed. Proof: `.wrangler/world-work/guidance-verified.json` and `guidance-waiting-name.png`. Full live manual walkthrough remains pending. No production changes, commit or push.


## Final tutorial polish and Local Minimap V1 - 2026-10-07 (staging only)

Live read-only timing diagnosis found Tester 2's actual pot plantedAt `2026-10-07T02:57:17.276Z` and readyAt `2026-10-07T02:57:32.276Z`: exactly 15 seconds. The staging Worker clock was about 16 seconds ahead of the local device clock. Client countdown, deadline refresh and Phaser plant stages compared server timestamps with device Date.now(), making effective UI readiness about 31 seconds. The tutorial API now adds response-only serverNow (never stored in the checkpoint). TutorialClock anchors server time to monotonic performance.now(). Countdown, one-shot readiness refresh and pot art share it. No normal Nursery, Farm, offline or production growth schedule changes; old persisted schedules remain compatible. Server tests reject collection at 14,999ms and permit it at 15,000ms; full browser tests use a deliberately 16-second-slow device clock and fail beyond 22 seconds.

Objective and NPC/pot dialogs use existing cg surfaces, copper borders/accents, muted text, display font and cg-button classes. The compact collapsible objective adds step feedback; no navigation shortcuts or gameplay completion buttons are restored.

Staging outdoor HUD order is Map / Travel / Menu. Map defaults closed and remembers its toggle only in the current game session. The north-up SVG minimap presents the whole current runtime Area, registered navigation obstacles (including clearance), authored exits and a small live player dot. Scene bindings publish at most 10Hz only while open; no HTTP requests or persisted movement are added. Farm/Town use actual registered collision geometry via their existing NavigationMap and retain locked runtime dimensions/art. No duplicate handwritten minimap geometry exists.

SVG inverse screen transforms handle scale/aspect-ratio letterboxing; coordinates then map proportionally into current runtime bounds. Valid/reachable destinations call existing NavigationController.move, replacing the current route like a normal ground click. Blocked/outside/unreachable goals are rejected with concise feedback and preserve an already valid route. No teleport, second follower, fast travel, world map or camera fit/zoom change is introduced. Scene teardown clears only its own binding; transition display rejects mismatched Area snapshots. Mouse/touch/pointer input is isolated. The minimap temporarily hides during chat, interactions, feature panels or transitions so those controls remain unobstructed, then returns if still toggled open.

Tester 2 was inspected read-only, without reset or automatically completing lessons. Its existing completed onboarding remains intact. Production, auth, Access/DNS/bindings, schema/grants, economy and unrelated/untracked files are preserved. Commit/push remains gated on manual acceptance.


Final polish staging release evidence (2026-10-07): guarded Worker `a4103776-5556-44a4-9d89-af3b0313f032` deployed `2026-10-07T08:08:50.993Z`, active at 100%; world hash remains `49b3fa3a69ab74a9`. Starting 25/25 (real PostgreSQL and full fresh-flow Chrome with a 16-second-slow device clock), minimap 3/3 and real Phaser browser 1/1 (26 transitions, Farm/Town walking, marker, invalid targets, camera and touch/mobile checks) passed without skips. Navigation, chat, menu, client, Dev Tools and Worker regression suites passed. Production/staging builds, Worker type check, lint and whitespace checks passed. Existing bundle-size and pg concurrency warnings remain.

Authenticated Chrome passed Farm reachable walking, blocked-building rejection, chat hiding/restoring the map, Map close/reopen, Farm -> Cross Path -> Path 2 -> Town through minimap clicks and normal automatic exits, refreshed geometry/exits/entry markers, Town reachable walking/blocked-building rejection, and normal Travel return to Farm. At 390x844 all seven HUD buttons occupied one row with no horizontal overflow. Desktop viewport was restored. Proof: `.wrangler/world-work/minimap-live-farm.png`, `minimap-live-town.png`, `minimap-live-mobile.png`; automated touch: `.wrangler/world-browser/mobile.png`. Tester 2 remains on Farm authored entry `from-cross-path-1` at (1500,1660). Read-only before/after checks matched onboarding revision 45, all 14 preserved row/digest groups, account/economy fields and prior reset receipt. Normal walking discovered Path 2/Town and updated location through server routes. No reset/tutorial commands. Protected staging fresh-pot timing and physical-phone acceptance remain pending manual testing; automated timing/mobile/touch passed. No production deployment or commit/push.

Files in this final-polish change; earlier uncommitted task files are preserved:

- Timing: `shared/api/startingExperienceV1.ts`, `server/api/router.ts`, `src/features/starting/StartingContext.ts`, `StartingProvider.tsx`, new `tutorialClock.ts`, `tutorialClock.test.ts`.
- Tutorial presentation: `src/features/starting/StartingObjective.tsx`, `WorldTutorialDialog.tsx`, `starting.css`; pot renderer clock in `src/game-world/LdtkAreaScene.ts`.
- Map: new `src/game-world/localMinimap.ts`, `localMinimap.test.ts`, `bindLocalMinimap.ts`, `LocalMinimapContext.ts`, `LocalMinimapProvider.tsx`, `LocalMinimapView.tsx`, `localMinimap.css`.
- Wiring: `src/app/GameSession.tsx`, `src/components/layout/GameHeader.tsx`, `src/game-world/AreaExitController.ts`, `LdtkWorldPage.tsx`, `FarmTestScene.ts`, `TownTestScene.ts`.
- Validation/docs: `package.json`, `server/starting/starting.integration.test.mjs`, `startingUiAcceptance.mjs`, `src/game-world/world.browser.test.mjs`, `PROJECT_CONTEXT.md`, this document.


## Fresh onboarding inventory and Farm state correction - 2026-10-07 (staging only)

Manual acceptance found reserved seed ownership displayed as a small Equipment paragraph beside zero ordinary seed stacks. The existing persisted tutorialSeedAvailable reservation is a real one-unit quest-material entitlement, never a commodity balance. Inventory now gives it a dedicated Tutorial materials card: San Pedro tutorial seed x1, Owned / Reserved for the Path 1 tutorial pot, with explicit nontransferable provenance. Zero commodity stacks are omitted; Regular seeds has an explicit separate empty state. Planting Path 1 atomically consumes only this reservation. Its namespace is absent from commodity/trade/Mail contracts; normal economic harvest rewards are still once-per-account, with historical checkpoints preventing duplicate minting after resets.

The old full reset differed chiefly in its name gate and preserved every nursery_occupancies row. Normal plants from earlier runs therefore survived. Full mode now deletes the target's actual Nursery occupancies and archives all its growing physical specimen IDs plus prior tutorial specimen/offspring IDs in the existing server reset audit. Archive IDs are cumulative across partial/full resets so later partial reset cannot resurrect earlier cleared material. Tutorial display assignments are removed. Specimen/genetic/lineage/history rows are retained; no fictitious sale or deleted auth identity. Partial mode preserves normal cultivation and name, but releases tutorial-provenanced occupancies as it archives practice material. Collected normal possessions, regular seed balances, Mail, currency, XP, research/property and unrelated backend history remain intact for reusable-account safety. This is an empty cultivation baseline, not deletion of existing collected normal possessions.

A genuinely fresh Farm has empty Nursery positions and the collected Path 1 tutorial specimen in Garden. First physical Farm arrival provides one protected Farm practice seed in the checkpoint, never a regular seed credit. Existing Nursery Plant Seed / seed picker explicitly offers it; a strict V3 tutorial:true intent is accepted only by staging/test, for the owned available reservation, San Pedro, current Farm and current Nursery lesson. The existing planting transaction creates real Nursery occupancy with standard baseline genetics/tutorial provenance and normal staging growth/planting progress. It consumes only the reservation, supports replay, and creates no tradable commodity asset or rare variant. Normal planting remains unchanged. Old archived planting receipts cannot advance a new Nursery lesson. Staging lifecycle and reset commands take the same canonical onboarding owner lock before cultivation locks. No migration, grant, dependency, collision, map, camera or production deployment changes.

Validation: Starting 27/27 including real PostgreSQL and full Chrome flow with zero ordinary seeds and six empty Nursery positions; reset persisted-occupancy removal, full/partial distinction, cumulative archive, correct name routing, reserved seed restrictions/consumption, production rejection and real Farm/research/breeding completion passed without skips. Dev Tools 7/7, lifecycle/breeding rules 9/9, reconciliation 6/6 and client 24/24 passed. Production/staging builds, lint, client/Worker type checks and diff whitespace checks passed. Existing Vite bundle-size and pg concurrency warnings remain. Read-only isolated staging preflight verified cactigrow_staging/cactigrow_staging_runtime and existing DELETE permissions on Nursery/display tables; no grants applied. LDtk hash unchanged 49b3fa3a69ab74a9.

Guarded staging Worker 8b76ff3e-bb94-4aec-9691-9b66b8a5b780 is active at 100%, superseding a4103776-5556-44a4-9d89-af3b0313f032. Authenticated live Chrome verified the reserved seed card with BOTH regular seed balances zero and mobile 390px no overflow, without advancing a lesson. The user-requested Full Character Onboarding reset targeted only Tester 2 / 0de86abc-e886-4870-a077-ada947bf638f through Dev Tools with explicit UUID confirmation. Receipt c091f50b-4156-4546-b97e-b2d9e298f323 at 2026-10-07T08:39:30.031Z: revision62, name/appearance/tutorials pending, empty equipment/reservations/pot/parents/offspring; Starting Spawn default (1344,704), initial discovery only, no Travel. Nursery and displays are empty. The live account already had zero occupancies before this reset (it did not clear occupied beds during this action); occupied full-reset clearing is covered by PostgreSQL tests. Seven prior tutorial specimens and three practice offspring remain archived. Six already-collected normal specimens are intentionally preserved, along with normal possessions/identity/history. All 14 before/after record digest groups and six account/economy initialization fields matched. Chrome remains at empty character-name selection after reset; no tutorial steps completed. Proof: .wrangler/world-work/fresh-seed-live.png, fresh-seed-mobile-live.png, fresh-farm-before.json, fresh-farm-after.json, fresh-farm-waiting-name.png. Manual fresh live Farm walkthrough and physical-phone acceptance remain for the user. No production, Access/DNS/binding, commit or push changes; unrelated/untracked files preserved.

Current-task files: shared/api/startingExperienceV1.ts, startingExperienceV1.test.ts, plantLifecycleV3.ts, startingResetV1.ts; server/starting/startingState.ts, StartingExperienceService.ts, StartingResetService.ts, starting.integration.test.mjs, startingUiAcceptance.mjs; server/gameplay/PlantLifecycleService.ts; src/app/PlantLifecycleContext.ts, PlantLifecycleProvider.tsx; src/features/inventory/InventoryPage.tsx; src/features/nursery/NurseryPage.tsx, SeedPicker.tsx; src/features/starting/TutorialMaterials.tsx (new), EquipmentInventory.tsx, WorldTutorialDialog.tsx, tutorialGuidance.ts, StartingResetControl.tsx, starting.css; PROJECT_CONTEXT.md and docs/STARTING_EXPERIENCE_V1.md.


## Accepted staging baseline checkpoint - 2026-10-07

The user accepted this milestone as part of the current staging visual/world development baseline and explicitly authorized committing/pushing the accepted work. This supersedes earlier visual-acceptance and commit/push hold language in this historical implementation report. Outstanding device/performance and other unperformed verification remain documented limitations. See PROJECT_CONTEXT.md, Accepted staging visual/world development baseline. Future development is staging only; no production deployment, database or configuration change is authorized by this checkpoint.
