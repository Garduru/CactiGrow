# Collection management release report

Released October 2, 2026 to the existing production Worker. Garden now shows protection, research and listing state directly on collection cards and supports explicit manual batch research and breeding shortlists. Existing server rules, growth, genetics, currency, movement and settlement remain authoritative.

1. **Previous collection UX.** Production `ServerGardenPage` showed collected mature specimens, Quick view, Details, display assignments and bulk NPC sale. It lacked collection filters and card research/listing indicators. The local Garden already had organization filters behind Organized Beds. Inventory is seed storage. Existing details, research, commerce and breeding workflows were inspected and reused; no duplicate detail system was created.

2. **Favorite persistence.** The existing `player_garden_specimens.favorite` boolean already stores per-player, per-specimen protection with a false default. The existing authenticated Garden command and projection remain the mutation/read path. Favorite and unfavorite were verified through separate authenticated API reads in isolated PostgreSQL. Protection now works at Garden Level 1; tags still require Organized Beds.

3. **Protection rules.** Favorites block NPC sale, Marketplace listing and Marketplace ownership transfer through `assertSpecimenUnprotected`, including stale clients. Ownership is derived from authentication. Favorite requests reject invalid IDs and extra owner fields. Non-destructive research and manual breeding remain allowed. Direct specimen trade is not implemented; the reusable protection predicate is ready for future transfer flows.

4. **Marketplace and NPC integration.** Favoriting an actively listed specimen returns a clear conflict while holding the specimen lock shared with listing creation, sale and settlement. Listing cancellation is explicit. A real PostgreSQL Favorite/listing race produced one winner and no contradictory state. Nonfavorite listing, cancellation, settlement and NPC sale regression checks passed. Bulk-sale confirmation excludes protected, listed and unavailable specimens and reports the skipped count.

5. **Research projection.** Existing Grower research records remain durable knowledge keyed by clone line. Cards derive Unresearched, Studied at the recorded research depth, or Research complete from that projection. Research available follows the existing next milestone and Genetics level. Repeated physical specimens share the same research record and cannot duplicate milestone XP.

6. **Card indicators and details.** Cards retain the shared plant visual, species, scientific name and specimen identity, with a filled/unfilled Favorite control, research badge and active-listing badge. Summaries show at most two legitimately known visible traits. Unknown genetics stay labelled unknown. Details reuse `PlantDetails` with Favorite, research status/action, breeding and protection-aware commerce controls; opening them does not navigate away from the game.

7. **Filters.** All, Favorites, Unresearched, Studied, Research available, Research complete, Species, Eligible to breed and Listed/Unlisted combine. Garden maturity controls and labels were removed in the cleanup because all collected specimens are mature; growing plants and readiness feedback remain in the Nursery. Local tag and visible-special organization filters remain available.

8. **Search and sorting.** Search covers species/common/scientific name, specimen ID, tags and an existing local nickname if present. The current server projection has no durable nickname, cultivar or clone-name field. Hidden genetics are never searched. Sorting supports newest, oldest, species/name, Favorites first and clone line with deterministic identity tie-breaks. No value or rarity metric was invented.

9. **Bulk selection.** Selection is transient UI state. Individual selection, Select page, Select filtered, Clear and Done show the full selected count. Filtering and pagination retain owned selected IDs, including selections outside the current filter. Lost ownership removes an ID from selection. Selecting specimens alone never triggers an action.

10. **Manual batch research.** Review shows eligible/skipped counts before confirmation. The existing authenticated Grower API accepts `research-specimens` with 1–100 unique specimen IDs and the normal command receipt. Server ownership, collected maturity, existing research and progression are rechecked. Each distinct clone line advances one available milestone at the starting Genetics level; XP gained during a batch cannot expand that batch's eligibility. Already completed or level-blocked milestones and repeated clone lines are skipped with reasons. Existing observation/analysis currently has no Token cost or timer. Results immediately reconcile authoritative research/XP and update cards and filters without reloading. Successful responses show researched/skipped/failed counts; uncertain responses prompt checking refreshed state and retain the exact receipt for retry. Unexpected database errors roll back the transaction rather than claiming partial success.

11. **Breeding foundation.** The collection offers eligible-parent filtering and a selected-parent shortlist. The existing server workflow now searches candidates, excludes active listings, shows known research/trait information and allows choosing the shortlist's first parent. Same-genus compatibility and confirmed one-pair breeding remain unchanged. Isolated PostgreSQL verified that a favorited parent can breed and both parents remain owned. Multiple unattended pairs and auto-breeding were not added.

12. **Progression foundation.** `canUseBulkResearch` and `canUseBulkBreeding` reuse the established Garden Level 2 Organized Beds upgrade. The batch API independently enforces that gate. Favorites and collection visibility are available immediately. No new skill thresholds, XP curves or progression tree were introduced.

13. **Large collections.** Collection rendering makes no per-card API requests and shows at most 60 cards per page. Filters use memoized existing projections; the batch server loads clone identities/genetics in grouped queries. Tests used 121 UI specimens and 1,000 model specimens, verified stable selections and source identities, and confirmed rendering alone made zero requests. These are automated fixture checks, not physical-device performance guarantees.

14. **Schema and migration.** None. Existing specimen identities, established genetics, clone lines, timestamps and research records were preserved. No production player records were edited by release verification.

15. **Runtime grants.** No production grant changes. The real isolated PostgreSQL harness exercised authenticated requests under its restricted runtime role. Its test-only grants were extended for the existing breeding writes so the Favorite-parent regression could run; they were not applied to production. Live authenticated production privilege checks remain part of manual acceptance.

16. **Mobile behavior.** Favorite and filtering controls use 44px minimum touch targets. Filters and action controls wrap, pagination bounds card rendering, and the selection bar remains reachable while scrolling. Collection surfaces stop mouse/touch/pointer start propagation. DOM tests verified mouse/touch events do not reach simulated world listeners and modal focus remains bounded. The browser connector reported no available browsers, so desktop layout screenshots, responsive visual acceptance and physical iPhone/Android checks were not performed.

17. **Validation.** Passed production build, lint, Worker typecheck, `test:collection` (7), `test:commerce` (4, including real isolated PostgreSQL), `test:garden` (10), `test:e1` (9), `test:worker` (34), `test:client` (23), `test:menu` (7), `test:navigation` (12) and `git diff --check`. Commerce tests cover Favorite ownership/persistence/rejection, listing races, protected-parent breeding, batch gating/eligibility/idempotency, competing buyers and rollback. Collection tests cover research projection/filtering, carrier knowledge boundaries, 1,000-specimen filtering, selection reconciliation, immediate research updates, zero rendering requests and recovery after a rejected Favorite mutation. The existing large-bundle warning and the PostgreSQL harness's existing overlapping-query deprecation warning remain.

18. **Files changed.** Implementation and verification files are listed below. Pre-existing accepted movement files and unrelated archive/audit/benchmark files were preserved. This milestone made no commit or push.

19. **Production result.** Deployed successfully using the existing guarded `CACTIGROW_DEPLOY_CONFIRM=production` and `npm run deploy:production` workflow. `/api/health` returned 200 with production environment. Homepage HTML and entry/CSS/Farm/Town/Phaser bundles matched the validated local build by SHA-256. Anonymous bootstrap, Garden, Grower and lifecycle requests returned 401. No DNS, staging, authentication or infrastructure changes were made.

20. **Worker version.** `a869e2a4-efa6-4033-a118-c84397d0da8b`. Production entry asset: `index-CH9fqqbJ.js`. Previous movement version: `fe5c90ec-48a6-4e41-9415-4d763bff78b2`, documented in `PROJECT_CONTEXT.md`.

21. **Manual production acceptance.** Sign in on desktop and phone; favorite/unfavorite, reload and verify both devices agree. Confirm protected NPC sale/listing rejection and active-listing Favorite rejection until cancellation. Combine Favorites/species and Unresearched/species filters, change pages and confirm selection remains stable. Research one plant and a mixed selected batch; verify badges, skip counts and XP after reload. Breed with a Favorite and verify both parents remain. Check 320px/mobile wrapping, scrolling, focus, touch targets and that panel interactions do not move the world character. Recheck normal nonfavorite commerce with the established two-account acceptance workflow. These authenticated live writes and physical-device checks were not performed by the release automation.

## Implementation and verification files

- `PROJECT_CONTEXT.md`
- `package.json` (adds `test:collection`; preserves the pre-existing navigation script)
- `server/gameplay/GardenService.ts`
- `server/gameplay/GrowerAlphaService.ts`
- `server/gameplay/specimenCommerceEligibility.ts`
- `server/gameplay/commerce.integration.test.mjs`
- `shared/api/gardenV1.ts`
- `shared/api/growerAlphaV1.ts`
- `src/app/GardenAuthorityProvider.tsx`
- `src/app/GrowerAuthorityProvider.tsx`
- `src/app/growerCommandRunner.ts`
- `src/features/breeding/ServerBreedingWorkflow.tsx`
- `src/features/garden/BulkResearchDialog.tsx`
- `src/features/garden/CollectionKnowledge.tsx`
- `src/features/garden/CollectionTools.tsx`
- `src/features/garden/FavoriteControl.tsx`
- `src/features/garden/GardenOrganizationControls.tsx`
- `src/features/garden/GardenPage.tsx`
- `src/features/garden/MultiSellDialog.tsx`
- `src/features/garden/PlantDetails.tsx`
- `src/features/garden/ServerGardenPage.tsx`
- `src/features/garden/useGardenSelection.ts`
- `src/features/garden/collectionManagement.ts`
- `src/features/garden/collectionManagement.test.ts`
- `src/features/garden/collection.runtime.test.ts`
- `src/features/marketplace/SellWorkflow.tsx`
- `src/features/research/ResearchWorkflow.tsx`
- `src/game/GameStateProvider.tsx`
- `src/game/gameState.ts`
- `src/styles/game.css`
- `docs/COLLECTION_MANAGEMENT_V1.md`


## Collection V1 cleanup

1. **Cause.** The player confirmed Garden Level 1. Before editing, the actual `ServerGardenPage` component reproduced a disabled Research Selected button with selected specimens and no button-specific explanation. The same component with the actual Grower/Garden/GameState providers, command runner, typed client, authenticated Worker and disposable PostgreSQL successfully researched a Favorite at Garden Level 2. The failure was unexplained progression gating before a request, not a failed server research mutation. Live-browser reproduction was unavailable because the browser inventory was empty.
2. **Fix.** Both Garden paths use `ResearchSelectionAction`, with visible status text, an accessible description and tooltip. It explains no selection, no available milestone, the 100-specimen cap and an already-open dialog. Eligible/skipped counts appear before opening the existing confirmation. The dialog also rechecks its current client gate/eligibility and displays researching status while busy.
3. **Gate.** The disabled action explicitly says `Requires Organized Beds (Garden Level 2).` The existing unlock, upgrade price/requirements and server rejection below the gate are unchanged.
4. **Results and refresh.** Existing authoritative researched/skipped results and projection restoration update cards, XP and the active Unresearched filter immediately. Selection retains owned IDs through research/filter changes; lost ownership still prunes IDs. Favorites may be researched. No reload, world remount, research cost/timer or extra invalidation was added.
5. **Garden maturity.** Removed Mature quick filter, Maturity sort and their Garden-only model options, green mature card badges in both Garden paths, Quick view Stage, and redundant mature Stage in normal Garden details. Useful filters retain the existing wrapping layout. No filler stats were introduced.
6. **Nursery and previews.** Nursery maturity/readiness, growth progress, harvest eligibility, stored timestamps and timing were untouched. The read-only visual test tool retains Stage through the existing `readOnly` condition; no Dev Tools behavior changed.
7. **Cleanup files.** `PROJECT_CONTEXT.md`, this report, `src/features/garden/ResearchSelectionAction.tsx`, `collectionManagement.ts`, `CollectionTools.tsx`, `ServerGardenPage.tsx`, `GardenPage.tsx`, `SpecimenQuickPreview.tsx`, `PlantDetails.tsx`, `BulkResearchDialog.tsx`, `collectionManagement.test.ts`, `collection.runtime.test.ts`, `src/styles/game.css`, `server/gameplay/collectionUi.integration.mjs`, and `server/gameplay/commerce.integration.test.mjs`. Other existing uncommitted implementation and unrelated files were preserved.
8. **Validation.** Production build, lint, Worker typecheck, collection (7), real disposable PostgreSQL commerce (4), Garden sale (10), lifecycle/breeding (9), Worker (34), client (23), and diff whitespace checks passed. Coverage includes one and multiple eligible specimens, mixed studied/unresearched, complete/level-blocked/shared clone lines, Favorites, no eligible specimens, below/above Organized Beds, batch cap, selection/filter refresh, busy status, input isolation and modal focus. The new integration exercises actual UI/providers through the actual API/server/database, not a mocked research mutation. Existing bundle-size and PostgreSQL overlapping-query warnings remain.
9. **Production deployment.** Guarded `npm run deploy:production` succeeded. Production health returned 200 with environment production; anonymous bootstrap/Garden/Grower/lifecycle APIs returned 401. Live HTML and all five CSS/JS assets matched the validated build by SHA-256. Entry asset: `index-DstPQNfZ.js`. No migration, grant, infrastructure, commit or push changes were made.
10. **Worker version.** `d391700a-41c9-479c-93ab-f5e63c0c4a9c` on the existing `cactigrow-api-production` Worker.
11. **Manual verification.** Sign in to production at Garden Level 1 and verify the explicit lock message. After purchasing Organized Beds, research a Favorite and a mixed batch and check immediate badges/filter results. Check desktop/320px/phone wrapping, normal Garden details/Quick view, and Nursery ready-to-harvest feedback. Authenticated live gameplay and physical-device visual acceptance were not performed by this session.
