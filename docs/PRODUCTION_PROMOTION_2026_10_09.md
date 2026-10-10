# Full staging experience production promotion

The user requested production deployment and selected **Promote the full staging experience**. Production source now enables the existing authored world/art, saved appearance, onboarding, minimap, exploration/Field Survey, Town content, movement checkpoints/proximity and Wild Genetics.

## Release state

**Promoted to production.** Worker `b014adaf-bdae-45d0-ba18-7ed6ce53f071` is active at 100% from `2026-10-10T05:47:16.881Z` (2026-10-09 Pacific), replacing `2c5d387a-2970-4574-bca3-cb55743f83f0`. Staging remains `83a7f1ef-d59d-49ac-8219-38e5c100eb8d`. The user explicitly authorized production migration 0008, narrow new-table SELECT/INSERT/UPDATE grants, deployment after successful verification and post-deploy acceptance checks, then authorized a clipboard owner-URL handoff.

The production release phase performed no git staging, commit or push. The user subsequently authorized committing and pushing this promotion to the existing GitHub `main` branch. The source checkpoint includes the reviewed Wild Genetics implementation, production activation, regression coverage and release documentation. The archive, Garden audit and benchmark report remain excluded and preserved.

## Behavior and preserved boundaries

Production `/play`, `/farm`, `/town` and `/world-preview` resume authoritative `/world`. Existing interiors, public homepage, verified identity/bootstrap and normal authoritative cultivation/research/breeding remain. Production uses the accepted player movement owner and AreaPresence for checkpoints, private Farms, proximity, corrections and safe-location persistence. HUD balances use current authoritative Grower values. Existing clients should refresh after release to load the world admission contract.

Normal production San Pedro/Peyote growth remains 300000/900000 ms; tutorial growth remains 15000 ms. Rarity, genetics, economy and other gameplay values are unchanged. Raw wild lots remain nontransferable; grown specimens follow existing Marketplace/Mail rules. Production Dev Tools/reset/forced-wild outcomes remain unavailable. Art, LDtk/generated world, dependency lockfile and production config are unchanged. No Access/DNS/binding/auth-provider/DO storage change is included.

Checkpoint authority is bounded endpoint/route validation, not continuous simulation or proof of the intervening player path. Isolated test evidence does not cover live production, physical iPhone/Safari/FPS/load or simultaneous paired live players.

## Exact database prerequisite

A remote preview using the existing production Hyperdrive performed `BEGIN READ ONLY` and rollback. It verified `cactigrow` / `cactigrow_runtime`, 23 existing table privilege sets, two existing players' Grower/Garden/Social/Mail projections, OWNER access, ordinary-player Admin denial and cultivation treatment UPDATE. Existing grants pass; schema owner is `cactigrow_owner`. `public.wild_genetic_seeds` is absent.

Completed mutation: only additive `0008_slim_giant_man.sql`, creating one retained seed table, nine validated constraints and its owner index, recording its exact hash/journal entry in existing Drizzle tracking. Applied only missing `SELECT`, `INSERT`, `UPDATE` on that new table to `cactigrow_runtime`. No old migration/grant/bootstrap, data reset, old-row modification or automatic privilege revocation was performed. Direct `cactigrow` / `cactigrow_owner` identity was verified first; scoped ensure and separate verify both passed. Do not reapply migration/grants merely to prepare credentials.

`wild-genetics:rollout:production` rejects staging/pooled/wrong-role URLs, verifies live database/owner identity and exact tracking/constraints/index/narrow runtime privileges. `--ensure` additionally requires `CACTIGROW_PRODUCTION_MIGRATION_CONFIRM=0008` and `--confirm-database cactigrow`, set only after explicit migration approval. `--check-connection` and `--verify` do not mutate schema/grants.

Secure preparation from the repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-production-owner.ps1
```

The helper prompts for masked raw direct Neon owner URL input, validates endpoint/database `cactigrow`/role `cactigrow_owner`/TLS, and verifies live identity read-only. It stores a DPAPI-encrypted credential in ignored `.wrangler/production-owner.credential.xml` for the same Windows user/machine. It performs no migrations/grants/deployments and refuses overwrite. Never paste credentials into chat. Restore process environment and remove the temporary encrypted file after successful authorized use.

The authorized clipboard URL was read without displaying it or writing plaintext credentials. The owner process environment was restored and the clipboard credential cleared. No encrypted owner file was needed. Initial clipboard cleanup failed after migration/verification had succeeded; cleanup was corrected without repeating migration/grants.

Read-only runtime preflight after 0008 verified 24 table privilege sets with no missing/excessive grants and two players' valid V3 lifecycle/Grower/Garden/Social/Mail projections, OWNER access and ordinary-player Admin denial. V3 projection checks explicitly skipped the existing lazy production schedule mutation while preserving production projection options; `BEGIN READ ONLY` plus rollback prevented player data writes. Both players have zero wild lots. Evidence: `owner-rollout.log`, `owner-rollout-result.json`, `prerequisites-after-0008.json` in the release evidence folder.

Fresh `npm run build` immediately preceded guarded `CACTIGROW_DEPLOY_CONFIRM=production npm run deploy:production`. Deployment passed: 45 newly uploaded static files, 2077.59 KiB Worker upload / 258.11 KiB gzip, 25 ms startup, existing production bindings/domains. The deploy wrapper does not build assets.

## Live release verification

- Deployment metadata confirms version `b014adaf-bdae-45d0-ba18-7ed6ce53f071` at 100%.
- Apex and www health return 200 / production. Both served HTML hashes match the fresh build; `/world`, `/play`, `/town` serve the SPA.
- Eight normal protected endpoints, including world/onboarding/exploration/survey/Town/movement/V3 lifecycle, return unauthenticated 401. Five production Dev Tools/reset endpoints return 404.
- Entry JS, LDtk world chunk, CSS, favicon, social icons and branding logo return 200 and match local SHA256 bytes. Entry remains `/assets/index-uM0TTlmo.js`.
- Live Chrome renders the public homepage and normal production sign-in screen on Play, with no console warnings/errors. No existing signed-in production tab was available. Authenticated live gameplay, physical-device/performance and paired live acceptance remain unperformed; the earlier isolated production-mode Chrome/PostgreSQL/workerd evidence remains distinct.

HTTP evidence: `postdeploy-http.json`; deployment/build logs: `deployments-after.log`, `deploy-production.log`, `build-deployed.log`. Protected config/lockfile/world and excluded-file hashes match the authorization snapshot; locked art remains unchanged. No unrelated production change occurred.

## Validation

Evidence: ignored `.wrangler/production-promotion-20261009/`.

- Production build, lint, Worker types/freshness/typecheck and 42 Worker tests pass. Production dry run passes with existing bindings only, 2077.59 KiB upload / 258.11 KiB gzip. Entry `/assets/index-uM0TTlmo.js`; LDtk chunk `LdtkWorldPage-CGzlJI5V.js`.
- World/routing/Exploration/Survey/Town group: 77 pass, zero skips.
- Movement: staging/production restricted PostgreSQL authenticated API suites pass (14 tests); unit/client and actual paired staging/production workerd socket checks pass. Impossible packets correct their sender and preserve the other player's movement.
- Wild Genetics: 32 pass, zero skips. Actual PostgreSQL lifecycle/research/breeding, receipts/rollback/source limits, transfers/provenance and both guarded rollout CLIs. Missing production approval rejects before table creation; repeated approved ensure preserves old rows/tracking and applies only 0008 once.
- Starting: 29 pass, zero skips, including actual full-app Chrome in both modes, isolated API/database, real Nursery/Garden/research/breeding, refresh and 320/360/390 widths. Production reset UI/API remain excluded. Production browser evidence: `.wrangler/starting-browser/acceptance-production.json`.
- Town Chrome test passes including enabled production provider/NPCs. Commerce, Mail, Collection, API client, reconciliation, realtime admission/AreaPresence/chat and Dev Tools exercised. Initial Mail fixture lacked new-table SELECT; corrected Mail/client run passes 38 tests. An older direct-Node navigation fixture lacked Vite mode; bundled real navigation passes both website tests across development/staging/production. Other original regression checks passed. Fixtures were corrected without live grant/gameplay changes.
- Whitespace and production helper PowerShell syntax checks pass. Existing Vite large-chunk and pg concurrent-query deprecation warnings remain.

## Promotion source scope

Runtime gates: AppRouter/farmReturnNavigation, GameHeader/headerPlayerModel, Starting/Exploration/FieldSurvey/TownContent providers, WorldLocationProvider/LdtkWorldPage/PlayerCharacter/TownTestScene; server router/authentication, realtime admission/AreaPresence, movementPort, ExplorationService/FieldSurveyService/TownContentService/PlantLifecycleService/wildSeedRepository. The initializeGrower comment now reflects verified provider identity generally. Corresponding tests cover production; production rollout/helper/package command and this report are new. PROJECT_CONTEXT records the completed production release and subsequent commit/push authorization.

## Git checkpoint preflight

Fresh commit preflight passes 32 Wild Genetics tests and 42 Worker tests with zero failures/skips, lint, migration metadata validation, and both staging and production builds. Production remains the final local build with the deployed entry hash. Full intended-file review and explicit path staging exclude the three unrelated files, credentials and ignored release evidence. Baseline before commit: `main == origin/main == 26ae981`, divergence `0 0`. This git checkpoint performs no additional deployment or database operation; commit/push results and synchronization are verified separately in git.
