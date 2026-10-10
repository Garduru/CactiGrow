# Wild Genetics & Rare Finds V1

Implementation report, 2026-10-08. Staging only. **Implemented and locally verified; migration 0008 verified, staging deployed, and authenticated single-account live acceptance passed.** This document is an implementation record, not human visual approval or a release claim.

Subsequent status, 2026-10-09: the user authorized and completed the full staging experience production promotion, including Wild Genetics and migration 0008. [The production promotion report](PRODUCTION_PROMOTION_2026_10_09.md) supersedes this historical staging-only scope, production gameplay exclusions and uncommitted status. Production Dev Tools remain unavailable. The user separately authorized the reviewed source commit and push after promotion.

## 1. Genetic seed-lot architecture

An additive identity-bearing inventory object groups three individually resolved seeds into a lot. `server/db/schema/wildGenetics.ts` retains each seed's existing normal clone-line ID, source snapshot, feature states and provenance. Quantitative genetics live in the existing `genetic_profiles`; Shiny lives in `clone_line_variants`. Actual physical specimens are created when planting. No fabricated owned parent specimens or entries in `bred_seeds` are needed for a wild founder.

`server/exploration/wildSources.ts` uses the real `inheritGenetics` and `resolveSexualGeneticOutcome` functions. Their inheritance, mutation and Shiny rules are unchanged. React and Phaser consume server projections. Commodity stacks remain the existing numeric seed inventory.

## 2. Provenance model

`shared/api/wildGeneticsV1.ts` defines validated provenance: lot ID, authored source-node ID, population ID, Area ID, region/label, source classification, harvest timestamp, command ID and source version. Population IDs derive from stable authored node IDs. Each seed has a distinct server-generated identity and clone line. A retained seed row connects its grown specimen to provenance and features even after Marketplace/Mail transfer. Source parent profiles/features are snapshotted at harvest; subsequent tuning cannot reroll existing material.

## 3. Rarity model

Central staging tuning is **91% normal commodity-only, 8% uncommon lot, 1% rare lot**, with **three seeds per lot**. A genetic find adds its lot while preserving the ordinary commodity reward and XP. Uncommon and rare are source-find classifications, distinct from the existing specimen/phenotype rarity presentation.

Authored source profiles have balanced opposing quantitative tendencies around 50. Rare sources use a different balanced combination and existing variegation-carrier potential, not a stat multiplier or guaranteed expressed feature. Each sibling resolves independently through existing inheritance. Existing mutation tendency and independent 1/4096 sexual Shiny probability remain unchanged. These are conservative staging values, not accepted final economy balance.

## 4. Server roll architecture

`ExplorationService.execute` retains existing authentication/bootstrap, completed onboarding, persisted Area/revision, authored node, Movement Authority V1 accepted position, obstacle reach, equipped/owned tool and personal cooldown checks. Only then can a valuable roll occur. Area/revision must agree with movement authority. The staging router supplies the real movement port. A legacy fixture without it can produce only existing commodities.

Normal client harvest payloads cannot supply rarity, quantity, genetic outcome or special flags. The authored LDtk commodity contract, including `rareRollEligible: false`, remains unchanged: genetic eligibility is the new explicit server source registry layered on the accepted commodity interaction. No world geometry/art/registration/collision changes were made.

## 5. Exactly-once receipts

The existing locked player transaction and fingerprinted exploration command receipt return the original full reward on replay. Concurrent identical commands produce one lot. A separate `wild-genetic-harvest-receipt-v1` event records player, command, timestamp, source/population/version, outcome, reward type, lot/seed IDs and special-source status. Normal valuable-eligible rolls also get diagnostic receipts.

Lot rows, normal clone lines/profiles/variants, commodity reward, Harvesting XP, cooldown, population checkpoint and receipts commit together. Injected receipt failure rolls everything back. Planting also uses existing gameplay idempotency and owner serialization: concurrent replay creates one occupancy/specimen and consumes one seed; a second command cannot spend that seed again.

## 6. Harvesting skill influence

No new skill bonus in V1. Existing quantity, XP curves and Harvesting progression remain unchanged. Failed checks and retries do not award extra XP or roll again. There are no paid rolls or purchase/reroll hooks.

## 7. San Pedro behavior

Uses actual species ID `echinopsis-pachanoi`. Supported nodes are Cross Path; Paths 2, 3 and 4; and Basin Entrance Grove, Dry Wash and Old Cairn Stand. Ordinary harvest continues to use existing node yield/cooldown/XP. Wild seeds grow, research and breed through existing species behavior.

## 8. Peyote behavior

Uses actual species ID `lophophora-williamsii`. Supported nodes are Paths 2, 3 and 4; Western Basin, Southern Basin and Isolated Eastern Ridge. It uses the same lot contract and existing Peyote genetics, rendering and growth behavior. No species were added.

## 9. Special authored sources

Two existing Basin nodes receive stable special-population metadata: `basin-san-pedro-cairn` (Old Cairn Stand, `cairn` landmark) and `basin-peyote-ridge` (Isolated Eastern Ridge, `eastern-ridge` landmark). Neither has glowing or rarity-revealing art.

**Each special source can award at most one genetic lot per player for that player's lifetime.** Its first normal roll does not consume this entitlement; a later eligible uncommon/rare result does. After the lot is awarded, cooldown-valid harvests continue to give ordinary commodities. The retained rows preserve entitlement after planting, sale, Mail transfer, and Dev Tool cooldown reset. Rates and lot sizes are the ordinary conservative values, not guaranteed jackpots. Ordinary sources remain repeatable after their existing personal cooldown.

## 10. Inventory representation

`InventoryPage` renders separate compact Wild genetic seed lot cards with species, provenance, source classification and available quantity. Normal commodity stacks and bred seeds retain their existing representations. `wildSeedLots` is an optional V3 projection extension for staging/test compatibility; inventory does not expose profiles, hidden carrier states or source genetics.

## 11. Nursery/growth result

The existing `SeedPicker` adds lot rows to the normal modal and selects an available identity-bearing seed. `PlantLifecycleProvider` sends `/api/v3/me/plant-lifecycle/commands/plant-wild-seed`, then applies the acknowledged occupancy and seed decrement without a full inventory refetch.

`PlantLifecycleService.plantWildSeedV3` validates ownership, available seed status, normal Nursery capacity/occupancy and stored identity. It uses normal growth resolution, normal occupancy, normal collection, existing cultivation XP and the existing unique-seed planting progress path. Test staging San Pedro growth is the existing 120-second interval. It never resolves genetics again. Reload/new service instances and collection preserve genotype, features, variants and provenance.

## 12. Research result

`GrowerAlphaService` supplies retained wild feature truth to both single and batch research through the existing research model. Real Observe creates normal private player knowledge. Study/Observe gates and hidden-genetics disclosure rules remain unchanged. Source-find classification and provenance reveal no hidden attributes.

## 13. Collection result

Wild-grown specimens join normal `ownedSpecimens`, Garden and Collection. `restoreServerGameState` preserves origin in existing UI projections. Normal Details shows compact origin and source-find classification under Lineage. No Collection filter or organization system was added. Existing research/Collection regression tests pass.

## 14. Breeding integration

The real `breedSpecimens` path reads normal quantitative profiles/variants and retained wild features for actual owned mature parents. Wild parents can cross normally and produce existing `bred_seeds` with real physical parent IDs. Offspring follow existing ancestry/research rules; direct founder origin is retained on the founder, and offspring links its real parents rather than impersonating a newly harvested lot. No alternate breeding engine or reroll is introduced.

## 15. Marketplace/Mail policy

Raw lots/seeds are **nontransferable in V1**. Shop catalog does not contain them. Unsupported raw Marketplace intents and Mail attachment shapes are rejected; IDs cannot be flattened into commodities.

Grown mature specimens follow existing Marketplace and Mail rules. Marketplace public projection consumes the actual retained wild feature truth. A real test sells a wild-grown specimen, purchases it as a second player, sends it back via Mail and claims it; genotype/provenance remain unchanged. Private research stays scoped to the researching player.

## 16. Journal changes

Existing Journal adds compact population records: observed via the associated landmark, and genetic material collected via a successful harvest. Landmark discovery awards no seeds or genetic material. Journal reveals no source profiles or hidden carrier states. Collection timestamps persist in the existing exploration checkpoint.

## 17. Multiplayer/resource model

Personal cooldown/depletion remains unchanged. Two players can collect independently from the same source. Special entitlement is also per player. Current accepted Movement Authority V1 is the security baseline; this milestone does not expand or claim to eliminate its documented movement limits.

## 18. Dev Tools support

Existing staging/development Dev Tools offer Force normal/uncommon/rare for the next eligible harvest. Forced outcomes still require real movement, tool, cooldown and special entitlement checks; failed checks do not consume the pending outcome. The current player can inspect source identity and authored parents, cooldown projection, tuning, up to 100 newest retained seed rows and 30 newest receipts. Inspection does not change another player.

The existing local development inspector is supported with a migrated local database; normal valuable exploration/Nursery gameplay remains gated to staging/test like the accepted exploration service. Production Dev endpoints and the new planting route return 404 before authentication/database acquisition. Production assets were checked for deterministic wild Dev Tool strings and contained none.

## 19. Migration/schema changes

Generated migration `server/db/migrations/0008_slim_giant_man.sql` adds only `wild_genetic_seeds`, with retained source JSON, normal clone-line/physical-specimen foreign keys, individual/lot uniqueness, owner index and available/planted invariants. Existing tables, players, seeds, specimens, discoveries and quests are not rewritten.

`npm run wild-genetics:rollout -- --ensure --confirm-database cactigrow_staging` reads only `CACTIGROW_OWNER_DATABASE_URL` from its process environment. It does not load `.env` files or Wrangler/Hyperdrive configuration. It requires exactly `cactigrow_staging` / `cactigrow_staging_owner` both in the direct URL and from `current_database()` / `current_user` before any mutation. `--check-connection` performs only that read-only identity check, prints only the confirmed database/role and works before 0008 exists. Every other role, production/wrong database and pooled targets are rejected.

The rollout records only migration 0008 in existing tracking, adds only missing SELECT/INSERT/UPDATE on the new table to the existing staging runtime role, and validates constraints/index/grants. It does not rerun old migrations/grants or revoke privileges. `--verify` is read-only. Disposable real PostgreSQL tests prove exact-role rejection, a URL/session-role mismatch rejection before any table/tracking change, application, preserved sentinel/tracking and a no-change repeated ensure. The generic `db:migrate` script instead reads `DATABASE_URL`; it is not the scoped 0008 continuation.

**Initial live preflight (before the successful clipboard handoff):** a read-only remote preview confirmed `cactigrow_staging` / `cactigrow_staging_runtime`, required existing cultivation privileges and absence of the new table. No live migration or grant was attempted. The user clarified that the owner URL is not loaded in their terminal either. Repository env files, Windows process/user/machine variables and checked PostgreSQL/Neon credential locations contain no usable staging owner URL. Historical Mail documentation's loaded-terminal claim does not describe current credential availability.

A read-only lookup of the existing staging Hyperdrive metadata identifies its direct Neon origin hostname as `ep-wild-pond-arf5s9do.c-4.us-west-2.aws.neon.tech`. This is nonsecret metadata, not the migration connection. In Neon Connect, select the branch/primary compute matching that direct hostname, database `cactigrow_staging`, role `cactigrow_staging_owner`, connection pooling OFF and the raw PostgreSQL URL format. Keep TLS options. No project/branch display name was guessed. The owner password must be obtained securely from Neon; runtime/production credentials are not substitutes.

For agent continuation under the same Windows user, masked `Read-Host -AsSecureString` input can be exported as a Windows DPAPI-encrypted `PSCredential` to ignored `.wrangler/staging-owner.credential.xml`. The agent imports it without printing the value, validates the direct Neon target, loads only its process `CACTIGROW_OWNER_DATABASE_URL`, runs `--check-connection`, and only after successful live database/role verification runs the scoped ensure and verify commands. Clear the process variable and remove the temporary encrypted file after successful use. Those live identity/migration/grant and runtime prerequisite checks passed before deployment.

Optional masked preparation: run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-staging-owner.ps1` from the repository. This preparation helper prompts with masked input, checks the exact direct endpoint/database/owner and TLS option, verifies the live database/role read-only, then exports only an encrypted credential for the same Windows user/machine. It restores its process environment and never runs ensure, migrations, grants or deployment. It refuses to overwrite an existing credential file and withholds raw exception details. For future authorized owner work, the simpler clipboard load is `$env:CACTIGROW_OWNER_DATABASE_URL = (Get-Clipboard -Raw).Trim()` with the raw Neon PostgreSQL URL already copied; it does not display the value. Run the read-only `--check-connection` first. This rollout is already applied and verified; do not rerun it merely to prepare a connection. The temporary encrypted file was removed after successful rollout/acceptance and the process owner variable is absent.

Credential handoff attempt: the user's encrypted file was imported successfully; URI endpoint/database/owner checks passed. The live direct Neon connection rejected authentication with SQLSTATE `28P01`. A read-only diagnostic exposed only that fixed error category, never the connection string/password or native error text. The connection did not establish, so no live database/role identity was claimed and ensure/verify/deployment were not executed. A later clipboard handoff supplied the valid raw direct staging-owner URL. It was read without printing, and both live identities were verified before the scoped ensure. Migration 0008 and its constraints/index/grants passed subsequent verify; the staging runtime preflight reports ready. The failed earlier attempts caused no mutations. No role password was reset and no credential substitute was used.

## 20. Performance impact

Normal harvest uses the existing transaction plus one small diagnostic event for an eligible source; special nodes additionally check the indexed player's retained source entitlement. Genetic results insert three ordinary identities and three retained seed rows only on a find. No per-frame request, listener or rarity polling was added.

Lifecycle projection adds batched clone-ID truth reads for existing and extra Nursery slots and one owner-indexed available-lot query. Research and Marketplace use batched truth reads only when wild identities are relevant. Normal UI planting applies the command result locally and uses existing targeted grower invalidation. Inspector queries are bounded and manual. No production load/physical-device performance claim is made.

## 21. Staging Worker

Guarded staging deployment passed after direct owner identity, migration 0008 verification, runtime privilege preflight, fresh staging build and dry-run. New staging Worker: `83a7f1ef-d59d-49ac-8219-38e5c100eb8d`, entry `/assets/index-DtpbWEKo.js`, at `dev.cactigrow.com`. Previous Worker was `cc6828ab-525c-404e-8143-2ff1621fde05`. Production, Access/DNS, bindings and infrastructure remain unchanged. The authenticated single-account rare/common pipelines and reload acceptance passed as detailed below. This is automated acceptance evidence, not human visual approval.

## 22. Tests/build/lint

Verified during this implementation:

- Wild suite: 16 passing executions, zero failures/skips, real restricted PostgreSQL and real components. Optional Chrome fixture ran at 320/360/390/1280; Inventory, picker and scrolled provenance Details were inspected visually.
- Combined Movement, Exploration, Field Survey, commerce and Mail regressions: 97 passing executions, zero failures/skips, including actual authenticated API and workerd.
- Worker/client/Collection/lifecycle/reconciliation/Dev Tools group: 98 passing executions, zero failures/skips.
- Existing full Starting Experience database suite and real Chrome app flow passed, including normal Nursery/research/breeding, refresh and mobile HUD. This is isolated regression evidence, not protected staging live acceptance.
- Production/staging builds, Worker typecheck/type freshness, lint, migration check and diff whitespace checks. Existing Vite large-chunk warning and pg concurrent-query deprecation remain; no new dependency was added.

### Requested 24-point matrix

| # | Requirement | Current verified evidence |
|---|---|---|
| 1 | Normal harvest | Wild 1-2; existing Exploration integration |
| 2 | Commodity unchanged | Exact quantity/XP result and stack delta in Wild 1-2 |
| 3 | Server rarity | Central resolver boundaries; authenticated forced rare API fixture |
| 4 | No client rarity | Strict extra-field contract rejection and HTTP 400 |
| 5 | Movement/proximity | Wild 3-5; actual Movement API distant rejection/accepted-position use |
| 6 | Retry no reroll | Concurrent harvest, later replay and RNG counter unchanged |
| 7 | Exactly-once receipt | One event/lot under concurrent replay; injected failure rollback |
| 8 | Stable provenance | Harvest, inventory, growing, collection and transfer comparisons |
| 9 | Source identity | Node/Area/population persisted; three distinct clone lines |
| 10 | Normal Nursery | Real occupancy, own seed lock, duplicate-seed rejection; actual picker |
| 11 | Normal growth | Existing readyAt interval; early collection rejection |
| 12 | Specimen origin | Reload/new service instance and collection retain origin |
| 13 | Research | Real Observe private record and normal disclosure |
| 14 | Collection | Normal owned projection, actual Details/CollectionKnowledge render |
| 15 | Breeding | Real wild-parent cross produces normal seed with actual parent IDs |
| 16 | Siblings | Existing engine variation/bounded quantitative outcomes and carriers |
| 17 | Shop excludes lots | Actual shop command rejects lot ID |
| 18 | Raw Marketplace rejects | Actual raw seed-ID listing rejected; unsupported lot intent rejected |
| 19 | Raw Mail rejects | Unsupported lot/commodity-with-lot contract rejection |
| 20 | Cooldown | Recovering source rejects before roll; special lifetime survives reset |
| 21 | Personal resources | Second player gets a different lot from the same source |
| 22 | Survey unchanged | Real Field Survey regression suite; no lot/RNG objective |
| 23 | Production Dev absent | 404 before auth/DB; production asset string check |
| 24 | Movement regressions | Complete existing 28-execution Movement suite included in 97 |

## 23. Live end-to-end acceptance

Authenticated live rare pipeline passed on the deployed Worker with Staging Tester 2. The existing Dev Tool forced only the next eligible rare outcome; the player physically walked from Farm through Cross Path and approached the authored San Pedro. The server awarded one rare three-seed lot plus ordinary commodities/10 Harvesting XP. Inventory retained the lot through full reload, with Cross Path origin and raw transfer restriction.

The existing Nursery route and normal picker planted two separate siblings in empty positions 2/3, decrementing available lot seeds to one. A full reload during growth preserved both occupancies; normal 120-second growth completed and both specimens were collected into Garden. The pre-existing Nursery specimen was left untouched. Read-only exact staging-owner snapshots compare unchanged clone IDs, provenance, features and five ratings through planting/collection; both collected rows are owned and have no remaining occupancy.

Both specimens retained the rare-source origin in normal Details. Observe completed through Study Genetics: one sibling disclosed expressed variegation (82%); the other disclosed no expressed features. Hidden carrier state was not exposed. Collection retained both Observed labels and visible knowledge after full reload. Both passed the normal Eligible to breed filter and actual compatible-parent selection. One normal cross created seed `c98abeec-d839-439f-aa82-168b4880cc22` with the two actual wild parent specimen IDs; both parents remain owned. Read-only persistence evidence is in ignored `.wrangler/wild-genetics-work/live-*.json`; screenshot `live-breeding-success.jpg` records the accepted result.

The deterministic normal/common harvest also passed after legitimate return/approach and natural source cooldown expiry: commodities increased 68 to 76, Harvesting XP 220 to 230, with no new lot or genetic seed rows. Its persisted receipt is normal/commodity with null lot ID and empty seed IDs; the prior rare receipt remains exactly one. No own cooldown reset was needed. The in-world Journal shows Cross Path San Pedro as found while harvesting / genetic material collected, and other discovered populations as Observed; Field Survey remains complete. Screenshot `live-journal-populations.jpg` records that distinction. Final live 390x844 Inventory showed the distinct wild lot and bred offspring cards, with document scroll width equal to viewport width (390); `live-mobile-inventory.jpg` records it. The browser viewport was restored and panels closed. Simultaneous two-player live acceptance and physical-device acceptance remain manual; the personal-resource model is verified by isolated two-player database tests. The standalone legacy Garden-route Journal initially has no world location and waits for its exploration projection; the canonical in-world Journal is the acceptance surface.

## 24. Files changed

New: `shared/api/wildGeneticsV1.ts`; `server/db/schema/wildGenetics.ts`; migration 0008, its snapshot and journal entry; `server/exploration/wildSources.ts`; `server/gameplay/wildSeedRepository.ts`; `server/exploration/wildGenetics.integration.test.mjs`; `server/exploration/wildGeneticsUi.mjs`; `scripts/wild-genetics-rollout.ts`; `scripts/prepare-staging-owner.ps1`; this document.

Extended: `server/api/router.ts`; `server/db/schema/index.ts`; `server/exploration/{ExplorationService.ts,explorationState.ts}`; `server/gameplay/{PlantLifecycleService.ts,GrowerAlphaService.ts,MarketplaceService.ts}`; shared Exploration and lifecycle V2/V3 contracts; `src/app/{PlantLifecycleContext.ts,PlantLifecycleProvider.tsx,reconcilePlanting.ts}`; existing exploration context/provider, Dev inspection, Journal and feedback; Inventory, Nursery/SeedPicker and PlantDetails; game-state restoration, plant type and API client; `package.json`; `PROJECT_CONTEXT.md` appended status.

Existing Movement test adds a forced rare authenticated harvest/replay assertion and new fixture permissions; existing Mail rollout fixture excludes future migrations when testing its historical 0007 checkpoint. Neither changes runtime movement/Mail behavior.

## 25. Commit/push status

No files staged, committed or pushed. Observed baseline `main == origin/main == 26ae981`, divergence `0 0`. The unrelated untracked archive, Garden NPC audit and local benchmark report remain untouched and excluded. Art, LDtk/generated world, migration 0000-0007, dependency lockfile, infrastructure and bindings are unchanged.

## 26. Intentionally deferred

Raw identity-bearing seed trading/Mail; paid RNG; skill rarity bonuses; final economy balance; new species; visible rare-source phenotype art; additional Collection filters; new genetic traits; larger loot/discovery systems; provenance labels copied onto all descendants; stronger movement-security work beyond the accepted baseline; physical device and live production performance checks.

## 27. Recommended next milestone

The staging migration, deployment and required single-account live acceptance are complete. Next use an explicitly scoped staging population-balance review to compare normal yields, related sibling diversity, expressed phenotypes and discovery frequency through existing research. Keep visible phenotype hunting and identity-preserving raw seed commerce separate future milestones.
