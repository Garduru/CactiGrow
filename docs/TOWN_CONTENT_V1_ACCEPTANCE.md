# Town Content V1 acceptance record

Status: **Town Content V1 is accepted as the staging development baseline.** The subsequent user instruction authorizes committing and pushing the accepted work; the checkpoint acceptance below supersedes earlier review and Git holds. Implementation, automated validation, protected staging deployment and the authenticated Staging Tester 2 walkthrough completed on 2026-10-08. Worker `fc02bc50-19d0-4c3b-8d89-f05aa819c4f6` serves 100% on `dev.cactigrow.com`. Simultaneous paired live players and physical-phone checks remain unperformed; acceptance does not claim those checks were completed.

## Authorized scope and accepted baseline

The 2026-10-08 request authorizes additive Town Content V1 and protected staging deployment for review. Production deployment, database/schema/grant changes, infrastructure changes, and automatic commit/push are outside this request.

Inspection began at accepted source checkpoint `1efb2a051a8ca794d96908ab5b6726790d5696b0`. Prior protected staging Worker `23f0bca9-2f28-4a17-a944-1b46d84352a4` was confirmed by the fresh read-only deployment list before release (`.wrangler/town-content-work/staging-before-deployments.json`). `PROJECT_CONTEXT.md` was read completely before repository changes.

Town remains `Town_p1` / `town-p1`, authored footprint **432 × 416**, world position **(512, -160)**, runtime **2200 × 1500**. Both entrance spawns remain **(1100, 1280)**; the Path 2 exit remains **(1100, 1420)** with **246 × 118** trigger. Town discovery and Travel retain their existing authority and metadata.

The accepted Shop, Marketplace, settlement tiles, plaza, collision, entry/exit and Character V2.1 player/Mara assets are preserved. Only Mara had an existing exclusive NPC identity; three distinct Town identities therefore use new additive exclusive artwork through the existing NPC renderer.

## Authored content and presentation contract

| Stop | Saved LDtk type | Runtime position | Role and real service |
| --- | --- | --- | --- |
| Rosa | `TownNpc` / `town-rosa-steward` | (960, 1150) | Optional Town welcome, community/facility context, existing Mail panel |
| Tomas | `TownNpc` / `town-tomas-shopkeeper` | (930, 625) | Supplies guidance and existing Shop |
| Inez | `TownNpc` / `town-inez-botanist` | (1570, 940) | Botanical context and existing Survey/Journal information |
| Community notice board | `TownNoticeBoard` / `town-community-board` | (500, 795) | Existing botanical noticeboard artwork; relevant community/Survey status |

All four entities are optional and nonblocking. The new LDtk definitions require explicit runtime coordinates so the compact Town topology does not become gameplay geometry. The importer accepts these entity types only in `town-p1` with `areaType: town`, whitelisted IDs, `tutorial: false`, and both integer runtime overrides.

The board reuses settlement tile 51 at atlas source (384, 768) without moving or replacing its painted sprite. It has no exploration note ID, discovery reward or economy contract. No Mail building or Mail prop is added; Rosa links the existing Mail interface. The central plaza (1100, 850), Shop approach (650, 560), Marketplace approach (1510, 590) and Path 2 gate remain clear.

Rosa, Tomas and Inez have three separate exclusive atlases. Each has four authored stationary directional views packed into the existing 640 × 896 V2.1 format, with 128 × 224 cells and accepted baseline 216. The five columns repeat the corresponding idle view. Walking animation is **not authored or claimed** for these stationed actors. Player appearance input cannot select an NPC identity or asset URL. Existing player parts and Mara art are unchanged.

## Completed independent checks

- `shared/world/townContent.test.mjs`: **9/9 passed** in the initial run. It embeds accepted pre-change golden hashes, independently preserves the complete LDtk project and complete runtime world after removing only the four exact Town IDs and their two definitions, verifies UID bookkeeping, checks ten accepted physics rectangles and sixteen navigation nodes, proves entry/plaza/door/exit reachability, validates board reuse, rejects Town entities in every other Area, rejects malformed contracts, checks additive NPC asset/registration metadata, and checks deterministic offline authoring.
- Whole-project canonical accepted hash: `68c5eb6b013003a97e022bfe7de10dbc44993a240b99af357ce39ea6a7f89915`. Complete parsed-world hash excluding version: `d39ec521e51edce369cb795aa5b342232cdd0fdb4027f5aec4d227a6677fd511`. These are source expectations, not generated from the final Town implementation.
- Existing golden tests receive only narrowly named Town exclusions. Prior golden values are retained. The new Town suite independently checks the permitted additions, so the compatibility exclusions do not permit unrelated world changes.
- Repeated final read-only preservation audits passed: **147 pre-existing art/public/manifest files** matched `.wrangler/town-content-work/protected-baseline.json`; the three unrelated untracked exclusions matched `.wrangler/town-content-work/excluded-baseline.json`. The authorized LDtk source and append-only project context are reviewed separately. Deployment wrappers/configuration, authentication, schema and migrations are unchanged.
- Fresh remote staging metadata preflight at **2026-10-08T10:27:20Z** passed for exact database `cactigrow_staging` and role `cactigrow_staging_runtime`. Thirteen existing tables were checked, including event SELECT/INSERT and onboarding SELECT/UPDATE. The ignored evidence is `.wrangler/town-content-work/staging-readonly-preflight.json`. The probe used `BEGIN READ ONLY`, metadata SELECT and `ROLLBACK`; it made no gameplay, schema or grant changes. Temporary preview port 8799 was stopped and had zero remaining listeners.
- Guarded deployment wrapper inspection confirms explicit staging/production target and matching `CACTIGROW_DEPLOY_CONFIRM`; Town work has not changed the wrapper or `wrangler.jsonc`. Existing staging origin, Access configuration, Hyperdrive and Area Presence bindings remain the deployment boundary.

The initial combined Town, Field Survey, Settlement, Basin Environment and Basin Exploration source suite passed **35/35**, zero failures/skips, after those narrow compatibility updates. Final client, server, browser, build, lint and release results are recorded below. Asset hashes and exporter metadata do not establish human visual approval or physical-device performance.

The subsequent independent regression runs passed with **zero failures/skips**: World **19** (real disposable PostgreSQL), Exploration **32** (restricted real PostgreSQL), Field Survey **22** (restricted real PostgreSQL), Settlement **9**, Basin Environment **13**, Navigation **12**, Minimap **3**, and Menu **8**. These total **118** executions; including the nine new Town source checks gives **127** selected final executions. The earlier combined 35 includes overlapping tests and is not added to that total. Logs are ignored under `.wrangler/town-content-work/*-regression.log`. The existing `pg` concurrent-query deprecation warning was observed.

The existing actual Chrome/Phaser settlement regression also passed **1/1**, zero errors/skips. Both complete runtime geometry snapshots match their unchanged pre-settlement hashes: Farm `0cb3f33ef5a90ab551e063d96094139d06446469cce95530a598969d93ab7a5c`, Town `e06a0f59de80a6d6aff61df39831d4bba6fa22eb42bc6c82d2e9e2621490ae06`. The snapshot includes physics/world/camera bounds, player radius, registered building art/anchors, collision rectangles, interaction layouts, spawns, exits, inflated navigation obstacles, graph nodes and deterministic routes. Town retains **10 bodies / 16 nodes**. The fixture verifies existing building approaches, remote profiles, mouse/touch minimap, automatic exit, 320/360/390px widths and listener teardown. Evidence is copied to ignored `.wrangler/town-content-work/settlement-browser-acceptance.json`; this is controlled browser evidence, not authenticated live or physical-phone acceptance. The selected independent checks above plus this fixture total **128** final executions.

The final actual Chrome/Phaser full-world walkthrough passed **1/1**, with **26 physical transitions** through authored exit triggers, zero browser errors and zero skips. It covers authored exits/spawns/bounds, locked Farm/Town geometry and retained React HUD. Evidence is `.wrangler/town-content-work/world-browser-regression.log` and `.wrangler/world-browser/result.json`; it does not establish an authenticated live account walkthrough.

The final mounted Town Chrome fixture passed **1/1**, with zero browser errors. `.wrangler/town-content-browser/result.json` records four content targets, unchanged ten bodies/sixteen nodes, three distinct nonempty exclusive NPC atlases with four directional views, real Shop/Mail/Friends/Journal/Research/Marketplace panels, player-profile priority, keyboard and pointer interactions, 320/360/390px dialogue/minimap checks and zero added colliders. Reload restores first-contact notes with one session read. Independent mounted players retain separate dialogues. Delayed initial reads cannot replace newer contacts; a delayed Rosa save followed by Tomas and immediate Shop opening records both contacts once after dialogue closure; duplicate contact calls coalesce; account-switch epochs prevent old active/queued requests from publishing or dispatching. Town issues no Survey accept/report command.

Final validation results are listed without adding overlapping suites into a misleading grand total:

| Check | Final result | Evidence |
| --- | --- | --- |
| Town shared/API/geometry/content plus restricted PostgreSQL suite | 25/25, zero failures/skips | `.wrangler/town-content-work/town-complete.log` |
| Town restricted PostgreSQL focused run | 15/15, zero failures/skips; overlaps the combined Town suite | `.wrangler/town-content-work/server-focused.log` |
| Character appearance/registration/motion | 15/15, zero failures/skips | `.wrangler/town-content-work/characters-final.log` |
| Worker checks | 42/42, zero failures/skips | `.wrangler/town-content-work/check-worker.log` |
| Chat | 12/12, zero failures/skips | `.wrangler/town-content-work/test-chat.log` |
| Dev Tools | 7/7, zero failures/skips | `.wrangler/town-content-work/test-devtools.log` |
| Realtime source / runtime / admission | 45/45, 17/17 and 9/9, zero failures/skips | `.wrangler/town-content-work/test-realtime*.log` |
| Client / multiplayer client | 27/27 and 9/9, zero failures/skips | `.wrangler/town-content-work/test-client.log`, `test-multiplayer-client.log` |
| Existing commerce / Mail real PostgreSQL | 4/4 and 13/13, root-reported passing; no independently saved final logs/count verification | Final release check reported by the root agent |
| Full repository lint | Passed | `.wrangler/town-content-work/lint-final.log` |
| Production build | Passed | `.wrangler/town-content-work/build-production.log` |
| Staging build, run last | Passed | `.wrangler/town-content-work/build-staging.log` |
| Guarded staging dry run | Passed | `.wrangler/town-content-work/dry-run-staging.log` |

Both builds emitted the existing chunk-size warning; it was not a build failure. The existing PostgreSQL concurrent-query deprecation warning also remains informational. No remaining implementation blocker was found in independent server authority, reachability, client response ordering, scene lifecycle or preservation review.

## Production exclusion evidence

The production build log emits no `DevToolsPanel`, `StartingResetControl`, `StartingSetupReset` or `LdtkWorldPage` JavaScript chunk. The recorded scan of that production build found all four actionable markers absent: `Copied clean debug snapshot`, `Reset Full Character Onboarding`, `Reset own Field Survey quest only`, and `Reset Starting Experience`. The generic `CactiGrow Dev Tools` string remains as inert title data in `featurePanelState.ts`; it does not make a menu entry, panel or reset control reachable. The evidence is `.wrangler/town-content-work/production-exclusion.json`, supported by the actual production menu/provider runtime regression.

Source gates keep the Town provider inactive outside staging, exclude the staging LDtk page/dialogue route, and return before Town targets or NPC artwork loads in the production scene. The actual mounted production fixture confirms an inactive provider, zero Town reads, zero Town content targets and **zero Rosa/Tomas/Inez asset requests**. Shared asset URL strings and copied public files may remain in the build output; the verified claim is that normal production play does not fetch or render this staging content. The server Town and Dev Tools gates reject production before authentication/database work. Existing legitimate Admin Tools are a separate permission-gated feature.

For future checks, scan actionable reset/snapshot markers and excluded chunk names immediately after a production build, then inspect the production runtime fixture. Do not treat a generic title, feature ID, registry URL or copied static asset as a reachable control. The staging build was run last and now owns `dist`; its developer chunks are expected and must not be mistaken for production output.

## Required staging acceptance matrix

Automated results below are complete for their stated scope. Authenticated live results refer to Staging Tester 2 on the final release. A passing fixture or one live account does not establish simultaneous paired live or physical-phone acceptance.

| # | Check | Evidence/status |
| --- | --- | --- |
| 1 | Enter Town physically from Path 2; preserve spawn, discovery and full gate opening | Authenticated ordinary minimap walking crossed the Path 2 gate and arrived at (1100,1280); full-world exit/discovery/Travel checks passed |
| 2 | Three NPCs are visibly distinct, match accepted art style, and cannot be recreated exactly in the player creator | Source/appearance rejection and actual NPC pixel fixture passed; human visual approval pending |
| 3 | Click/tap Rosa from a distance; normal walker approaches before dialogue opens; E works in range | Authenticated 390px Rosa tap approached before opening; repeat in-range E passed. Actual pointer/touch/navigation fixture also passed |
| 4 | First Rosa conversation explains Town/community/facilities; later interactions show appropriate repeat copy; welcome is optional | Authenticated first welcome and repeat copy passed, including a repeat after Travel/reload; optional server/discovery tests passed |
| 5 | First contacts persist after reload and remain isolated between players; duplicate/replayed interactions do not add duplicate first-contact progress | Authenticated fresh Journal retained Met Rosa, Tomas, Inez; restricted PG concurrency/replay/rollback/isolation and mounted queue/account fences passed |
| 6 | Tomas opens the real existing Shop; ordinary Shop building interaction and approach still work | Authenticated Tomas E dialogue opened loaded seed and mature-specimen sale catalogs at 390px; no transactions. Existing building-approach fixture passed |
| 7 | Inez responds appropriately to existing First Basin Field Survey status without replacing Mara's acceptance/report authority | Authenticated Inez recognized the recorded survey and opened real Journal/Research. All other survey phases/gates passed in fixtures; zero Town Survey commands |
| 8 | Existing board opens a compact community panel with relevant Survey status and useful real actions, without dead or misleading controls | Authenticated board E panel showed Recorded and Mara attribution at 390px; other phases and action wiring passed in fixtures. No board reward/contact command |
| 9 | Existing Mail opens through Rosa and retains ordinary inbox/claim behavior; no fake new Mail building | Authenticated Rosa opened the loaded Inbox at 390px with two previously claimed test messages. No new attachment claim/send performed. Actual Mail/Compose fixture and existing PG13 passed |
| 10 | Marketplace uses its existing integration and ordinary world interaction; no new Town-presence gate | Authenticated ordinary Marketplace entrance/E opened the loaded existing listings panel; no matching listings, no trade. Building/menu fixtures passed |
| 11 | Plaza paths, Shop/Market doors, benches, planters and entrance/exit remain navigable; targets do not add collision | Authenticated walking connected all four stops, plaza and Market entrance. Complete golden/navigation/Phaser door/gate fixtures passed; ten bodies/sixteen nodes and zero new colliders |
| 12 | Town chat, Area Presence, remote characters and click/tap player profiles retain existing scope and priority | Authenticated Town-channel test message delivered; Friends opened an existing friend's profile. No second live Town avatar available. Chat/realtime/profile-priority fixtures passed; paired live pending |
| 13 | NPC/board dialogue and facility panels preserve HUD geometry, minimap, camera, avatar position and scene lifecycle | Authenticated panel open/close returned to ordinary walking and minimap; 390px HUD height52/one row, width390 with no document overflow. Actual mounted scene/listener checks passed |
| 14 | 320/360/390px emulated widths support tap, dialogue, close, Shop and Mail without overflow or clipped controls | Actual fixture checks passed at all three widths; authenticated390x844 Rosa/board/Shop/Mail/minimap passed, normal viewport restored. Physical device remains row15 |
| 15 | Physical phone repeats tap/dialogue/Shop/Mail/plaza/HUD checks | Pending physical device |
| 16 | Leaving/re-entering Town and Travel return preserve current content, discovery, route replacement and connection lifecycle | Authenticated Travel Town to Player Farm to Town and reload passed, retaining all three meetings/repeat copy. World/PG/full-world/latest-tap/lifecycle fixtures passed |
| 17 | Quest, currency, XP, normal inventory, genetics, Starting tutorial and Survey rewards remain unchanged by conversations and board use | Authenticated currency remained25, level7 and Survey Complete; no economy/claim operations. Restricted PG preserved-state/no-reward and existing gameplay regressions passed; no live full inventory/genetics snapshot claimed |
| 18 | Spoofed entity, stale revision, wrong Area, blocked sight, distant position and cross-player attempts fail; production excludes Town staging content | Strict DTO/ownership/reach/revision/receipt PostgreSQL tests and production build/runtime exclusions passed; no remaining automated blocker |

## Staging release procedure and final evidence

The existing guarded staging workflow completed after final review: targeted regressions, `npm run lint`, Worker checks, the production exclusion build, then `npm run build:staging` **last** so `dist` contains staging assets. Staging dry-run and repeated preservation/configuration/scope audits passed. Deployment used the existing `CACTIGROW_DEPLOY_CONFIRM=staging` wrapper and established isolated Cloudflare profile. No unqualified Wrangler deploy, migration, grant change, maintenance/reset or production action was performed.

The deployed Worker is **`fc02bc50-19d0-4c3b-8d89-f05aa819c4f6` at 100%** on `dev.cactigrow.com`, deployment **`04f9b214-2684-4ab5-b345-e6f15aac1b32`**, created **2026-10-08T10:57:41.397052Z**. `.wrangler/town-content-work/deploy-staging.log` and `staging-after-deployments.json` independently record the upload/version and rollout. Existing Access, DNS, Hyperdrive, runtime role and Area Presence bindings were preserved. The read-only staging preflight above proved isolation and required privileges; it did not create or reset contact history. Production was not deployed.

Authenticated walkthrough evidence is recorded in the appendix below. No Town commit or push has been performed. Physical-phone and simultaneous paired live account checks remain manual; independent mounted fixtures and disposable PostgreSQL tests do not complete them.

## Current task file inventory

The current reviewed working tree contains **47 Town task paths**: 21 modified tracked files and 26 additive files, including the root-owned append-only `PROJECT_CONTEXT.md` release record. Independent byte comparison confirms that its entire completely read initial prefix is preserved; the Town implementation appendix was also read. The three unrelated untracked files are excluded and preserved: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, and `local-ai-benchmark-report.txt`. Ignored local evidence, generated `dist`, credentials and temporary previews are not task source files.

| Scope | Exact paths |
| --- | --- |
| Acceptance/context | `docs/TOWN_CONTENT_V1_ACCEPTANCE.md`; `PROJECT_CONTEXT.md` (root-owned append-only release record) |
| New source art/export provenance | `art-source/characters/town-content-v01/desert-inez-idle-master-v01.png`; `art-source/characters/town-content-v01/desert-rosa-idle-master-v01.png`; `art-source/characters/town-content-v01/desert-tomas-idle-master-v01.png`; `art-source/characters/town-content-v01/export-report.json`; `art-source/characters/town-content-v01/prepare-assets.py`; `art-source/characters/town-content-v01/prompts.json` |
| New runtime art | `public/assets/characters/npc/inez/desert-inez-idle-v01.webp`; `public/assets/characters/npc/rosa/desert-rosa-idle-v01.webp`; `public/assets/characters/npc/tomas/desert-tomas-idle-v01.webp` |
| Authoring/import/generated world | `scripts/town-content-v1.mjs`; `scripts/world-import.ts`; `world/cactigrow-world.ldtk`; `shared/world/generatedWorld.ts` |
| Shared Town API/geometry | `shared/api/townContentV1.ts`; `shared/api/townContentV1.test.ts`; `shared/world/townGeometry.ts`; `shared/world/townGeometry.test.ts`; `shared/world/townContent.test.mjs` |
| Narrow world golden compatibility | `shared/world/basinEnvironment.test.mjs`; `shared/world/basinExploration.test.mjs`; `shared/world/fieldSurvey.test.mjs`; `shared/world/settlement.test.ts` |
| Server authority/routes | `server/town/TownContentService.ts`; `server/town/townContent.integration.test.mjs`; `server/api/router.ts` |
| Character registration/player protection | `shared/characters/appearance.ts`; `shared/characters/appearance.test.ts`; `src/characters/characterArt.ts` |
| Town React projection/dialogue/Journal | `src/features/town-content/TownContentContext.ts`; `src/features/town-content/TownContentProvider.tsx`; `src/features/town-content/TownContentDialog.tsx`; `src/features/town-content/TownContentJournal.tsx`; `src/features/town-content/townContentPresentation.ts`; `src/features/town-content/townContent.css`; `src/features/town-content/townContent.test.ts`; `src/features/town-content/townContent.browser.test.mjs` |
| Existing client integration | `src/app/GameSession.tsx`; `src/features/journal/FieldJournalPage.tsx`; `src/game-world/LdtkWorldPage.tsx`; `src/game-world/TownTestScene.ts`; `src/game-world/townWorldLayout.ts`; `src/game-world/world.browser.test.mjs`; `src/services/api/CactiGrowApiClient.ts`; `src/services/api/CactiGrowApiClient.test.ts`; `package.json` |

## Final-report topics

All twenty requested report topics are retained below. Completed implementation, automated and authenticated live evidence remain distinct from pending human visual, paired live and physical-device acceptance.

| # | Requested topic | Implemented result / acceptance boundary |
| --- | --- | --- |
| 1 | NPCs added | Rosa, Tomas, Inez; three saved Town NPC instances |
| 2 | NPC visual identities | Three additive exclusive four-direction idle atlases; repeated idle columns, no claimed walking animation; creator/pixel checks passed; human approval pending |
| 3 | Steward behavior | Optional first welcome/repeat conversation; existing community/Chat/Friends/Mail links; meaningful first contact only; source/PG/browser passed |
| 4 | Shopkeeper integration | Opens the real existing Shop; ordinary building preserved; actual panel/approach checks passed; no additional Shop backend |
| 5 | Botanist behavior | Botanical context, existing Research Log and Survey-aware copy; actual Research/Journal links passed |
| 6 | Community Board | Existing tile 51 becomes a compact real interaction; no new painted board, exploration note, reward or contact timestamp |
| 7 | Field Survey integration | Status/context only, hidden before Farm completion; Mara retains offer/report/reward ownership; all survey phase checks and zero Town Survey commands passed |
| 8 | Mail integration | Rosa opens the existing Mail/Compose panel; actual browser link/mobile check passed; no new Mail building; existing Mail PG regression root-reported passing |
| 9 | Marketplace integration | Existing building/menu Marketplace retained, actual browser checks passed; no new presence requirement |
| 10 | Town social/plaza result | Accepted ten bodies/sixteen nodes and registrations preserved; authenticated plaza walking, Friends/profile and Town chat passed; no second live Town avatar available |
| 11 | Journal changes | Compact server-projected discovery/first-contact notes; authenticated reload retained all three names; no fabricated task/reward progress |
| 12 | Multiplayer behavior | Player-local dialogue; mounted independent-player/restricted PG isolation and presence/chat/profile regressions passed; live Town chat/profile passed, simultaneous paired live pending |
| 13 | Minimap changes | Existing minimap, collision/path projection and latest-tap routing retained; mouse/touch fixtures passed; no minimap redesign |
| 14 | Staging Worker | `fc02bc50-19d0-4c3b-8d89-f05aa819c4f6`, 100%, deployed 2026-10-08T10:57:41.397052Z on `dev.cactigrow.com` |
| 15 | Tests/build/lint | Final source/PG/actual-browser suites, full lint, Worker checks, production/staging builds, dry run and read-only privilege/preservation checks passed as itemized above |
| 16 | Live acceptance | Authenticated Staging Tester2 Path2-to-Town walkthrough, facilities, plaza, Town chat, Travel/reload and390px checks passed; human visual, physical-phone and simultaneous paired live remain pending |
| 17 | Files changed | Exact 47 current task paths, including root-owned append-only context record; three unrelated files excluded and preserved |
| 18 | Commit/push status | The implementation handoff had no Town commit/push; the subsequent accepted checkpoint explicitly authorizes both, as recorded below |
| 19 | Intentionally deferred systems | No schedules, reputation/romance, combat, crafting, random events, auction house, separate currency or Verdara; optional meet-locals rewards and extra reset tooling omitted |
| 20 | Recommended next milestone | Human Town visual/physical-device and paired-player acceptance, then separately scoped next content/authority work |

## Authenticated final-release walkthrough

Completed at **2026-10-08T11:14:59Z** using connected Chrome and **Staging Tester 2**, whose Farm tutorial and Field Survey were already complete. The document loaded the final staging entry `/assets/index-DmefELtw.js`. All movement used normal minimap/canvas/keyboard controls; no teleport, hidden game state, manually issued gameplay API, reset or direct SQL writes were used for acceptance. Normal application commands persisted the three contacts, World travel and test chat message.

The requested sequence passed: **Path2 gate → Town → Rosa first welcome and repeat E conversation → Tomas → real Shop → community board → Inez → real Journal/Research → Rosa Mail → Friends/profile → Town chat → plaza → Marketplace entrance → Travel to Farm and return → reload → repeated Rosa and persisted Journal**. The single Town-channel test message was `Town Content V1 staging walkthrough complete.` and its rendered echo was verified. No Mail/DM send, purchase, sale or marketplace trade was performed. Two existing Mail messages were already claimed; a new attachment claim was not available or performed.

At **390x844**, Rosa's dialog measured366px wide within a390px document; document scroll width remained390px and HUD height52px in one row. Board text/actions, loaded Shop seed/sale catalogs, Mail Inbox and minimap controls fit and remained usable. Normal viewport was restored. All three contacts survived a fresh document reload and Travel return; Survey stayed Complete and currency stayed25. The account is left on the Town plaza near(1100,750), with no modal open. Final captured console errors/warnings: **zero**. Initial live walking was slow in this desktop session; performance on physical devices was not measured or accepted.

Ignored evidence: `.wrangler/town-content-work/live-acceptance.json`, `live-town-final.png`, `live-rosa-390.png`, `live-shop-390.png`, `live-board-390.png`, `live-mail-390.png`, `live-chat-390.png`, and `live-journal-reload.png`. The final Town screenshot shows the three new exclusive NPCs, existing board and accepted Shop/Market artwork; the Journal screenshot visibly shows `Met Rosa, Tomas, Inez.` after reload.

Remaining manual boundaries: human approval of the new NPC art, physical iPhone/Safari/performance and simultaneous paired live Town players/profile/DM exchange. A friend profile was inspected through Friends, but no second live Town avatar was present. Other Survey phases, fresh-player contacts, receipt concurrency/isolation, Mail claims and production rejection are verified by their focused fixtures/PG suites, not claimed as fresh live-account scenarios. No new implementation blocker was observed.

Final source audit (`.wrangler/town-content-work/final-audit.json`): **47 task paths**, **147 existing protected assets exact**, **3 unrelated files exact**, and all **174084 original context bytes exact**. Index remains empty. HEAD, local main and the locally recorded origin/main ref remain `1efb2a051a8ca794d96908ab5b6726790d5696b0`; no Town commit/push was made. The working tree contains the documented Town changes for review. No production deployment or production configuration/database mutation was performed; infrastructure remained unchanged.

## Accepted staging Town Content V1 checkpoint - 2026-10-08

After the implementation handoff above, the user explicitly accepted Town Content V1 as the staging development baseline and authorized committing and pushing its current work. This includes Rosa, Tomas and Inez; their exclusive artwork and presets; steward/shopkeeper/botanist interactions; Community Board; existing Mail and Marketplace world integration; persistent Journal meetings; supporting LDtk/import/shared geometry/API changes; and associated tests/documentation.

This acceptance supersedes the earlier human-review and commit/push holds for this Town milestone, including the NPC artwork review hold. Historical validation and live evidence remain unchanged. Unperformed physical iPhone/Safari/performance, simultaneous paired live accounts and fresh-player live checks remain documented limitations; acceptance does not claim those checks were performed.

Authorization is **commit and push only**. No deployment is performed for this checkpoint. Production remains on its existing stable baseline; its database/configuration, infrastructure, Access/DNS and bindings are unchanged. All three unrelated untracked exclusions remain byte exact and outside the commit: `CactiGrowProductionSource.zip`, `docs/GARDEN_NPC_SALE_AUDIT.md`, `local-ai-benchmark-report.txt`.

The checkpoint retains the exact accepted implementation/assets. Only this acceptance record and the append-only `PROJECT_CONTEXT.md` checkpoint note are added during commit preparation. The successful Town25, other targeted source/PostgreSQL/browser regressions, lint and production/staging builds recorded above are the validation evidence for this unchanged implementation. Git commit/push outcomes and final clean-tree/synchronization evidence are reported after the Git operations complete; the implementation-handoff audit above describes the earlier pre-commit state.
